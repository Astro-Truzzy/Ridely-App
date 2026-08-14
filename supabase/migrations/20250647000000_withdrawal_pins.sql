-- =============================================================================
-- 4-digit withdrawal PIN (users + riders). Hash stored server-side only.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.withdrawal_pins (
  user_id uuid PRIMARY KEY,
  pin_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_pins_locked_until
  ON public.withdrawal_pins(locked_until)
  WHERE locked_until IS NOT NULL;

ALTER TABLE public.withdrawal_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS withdrawal_pins_deny_all ON public.withdrawal_pins;
CREATE POLICY withdrawal_pins_deny_all
  ON public.withdrawal_pins
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Returns whether account has a PIN configured (no hash exposed).
CREATE OR REPLACE FUNCTION public.withdrawal_pin_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_locked_until timestamptz;
  v_has_pin boolean;
BEGIN
  SELECT locked_until, true
  INTO v_locked_until, v_has_pin
  FROM public.withdrawal_pins
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_pin', false, 'locked', false);
  END IF;

  RETURN jsonb_build_object(
    'has_pin', true,
    'locked', v_locked_until IS NOT NULL AND v_locked_until > now(),
    'locked_until', v_locked_until
  );
END;
$$;

REVOKE ALL ON FUNCTION public.withdrawal_pin_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdrawal_pin_status(uuid) TO service_role;

-- Set or change PIN. Validates 4-digit format.
CREATE OR REPLACE FUNCTION public.set_withdrawal_pin(
  p_user_id uuid,
  p_pin text,
  p_current_pin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_existing public.withdrawal_pins%ROWTYPE;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;

  SELECT * INTO v_existing FROM public.withdrawal_pins WHERE user_id = p_user_id;

  IF FOUND THEN
    IF p_current_pin IS NULL OR p_current_pin !~ '^\d{4}$' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Current PIN required');
    END IF;
    IF v_existing.locked_until IS NOT NULL AND v_existing.locked_until > now() THEN
      RETURN jsonb_build_object('success', false, 'error', 'PIN is temporarily locked. Try again later.');
    END IF;
    IF crypt(p_current_pin, v_existing.pin_hash) <> v_existing.pin_hash THEN
      UPDATE public.withdrawal_pins
      SET failed_attempts = failed_attempts + 1,
          locked_until = CASE
            WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes'
            ELSE locked_until
          END,
          updated_at = now()
      WHERE user_id = p_user_id;
      RETURN jsonb_build_object('success', false, 'error', 'Current PIN is incorrect');
    END IF;
    UPDATE public.withdrawal_pins
    SET pin_hash = crypt(p_pin, gen_salt('bf')),
        failed_attempts = 0,
        locked_until = NULL,
        updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    INSERT INTO public.withdrawal_pins (user_id, pin_hash)
    VALUES (p_user_id, crypt(p_pin, gen_salt('bf')));
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_withdrawal_pin(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_withdrawal_pin(uuid, text, text) TO service_role;

-- Verify PIN for withdrawals. Lockout after 5 failed attempts (15 min).
CREATE OR REPLACE FUNCTION public.verify_withdrawal_pin(p_user_id uuid, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.withdrawal_pins%ROWTYPE;
  v_attempts_left integer;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'PIN must be exactly 4 digits');
  END IF;

  SELECT * INTO v_row FROM public.withdrawal_pins WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Withdrawal PIN not set');
  END IF;

  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Too many failed attempts. PIN locked temporarily.',
      'locked', true,
      'locked_until', v_row.locked_until
    );
  END IF;

  IF crypt(p_pin, v_row.pin_hash) = v_row.pin_hash THEN
    UPDATE public.withdrawal_pins
    SET failed_attempts = 0,
        locked_until = NULL,
        updated_at = now()
    WHERE user_id = p_user_id;
    RETURN jsonb_build_object('valid', true);
  END IF;

  UPDATE public.withdrawal_pins
  SET failed_attempts = failed_attempts + 1,
      locked_until = CASE
        WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes'
        ELSE locked_until
      END,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING failed_attempts INTO v_attempts_left;

  RETURN jsonb_build_object(
    'valid', false,
    'error', 'Incorrect withdrawal PIN',
    'attempts_left', GREATEST(0, 5 - v_attempts_left)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_withdrawal_pin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_withdrawal_pin(uuid, text) TO service_role;

-- =============================================================================
-- Rider payout requests (earnings -> bank transfer)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rider_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  bank_code text NOT NULL,
  account_number text NOT NULL,
  account_name text,
  recipient_code text,
  transfer_code text,
  reference text NOT NULL UNIQUE,
  earning_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'initiated',
  failure_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rider_payout_requests_rider ON public.rider_payout_requests(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_payout_requests_reference ON public.rider_payout_requests(reference);

ALTER TABLE public.rider_payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rider_payout_requests_select_own ON public.rider_payout_requests;
CREATE POLICY rider_payout_requests_select_own ON public.rider_payout_requests
  FOR SELECT TO authenticated
  USING (rider_id = auth.uid());

-- Reserve unpaid rider earnings for payout; returns total and earning ids.
CREATE OR REPLACE FUNCTION public.reserve_rider_earnings(p_rider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric := 0;
  v_ids uuid[] := '{}';
BEGIN
  WITH claimed AS (
    UPDATE public.earnings
    SET status = 'paid',
        updated_at = now()
    WHERE rider_id = p_rider_id
      AND status IN ('pending', 'completed')
    RETURNING id, net_amount
  )
  SELECT COALESCE(SUM(net_amount), 0), COALESCE(array_agg(id), '{}')
  INTO v_total, v_ids
  FROM claimed;

  IF v_total <= 0 OR array_length(v_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No earnings available for payout');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'amount', v_total,
    'earning_ids', v_ids
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_rider_earnings(p_earning_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_earning_ids IS NULL OR array_length(p_earning_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.earnings
  SET status = 'completed',
      updated_at = now()
  WHERE id = ANY(p_earning_ids)
    AND status = 'paid';
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_rider_earnings(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_rider_earnings(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_rider_earnings(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_rider_earnings(uuid[]) TO service_role;

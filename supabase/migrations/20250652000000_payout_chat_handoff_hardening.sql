-- =============================================================================
-- Hardening: atomic rider payout reserve, handoff OTP lockout, chat column
-- guards, hide promo codes from clients.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Atomic earnings reserve (UPDATE … RETURNING, no TOCTOU window)
-- -----------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.reserve_rider_earnings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_rider_earnings(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 2. Handoff OTP: attempt lockout + crypto-random codes
-- -----------------------------------------------------------------------------
ALTER TABLE public.delivery_handoffs
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0
    CHECK (failed_attempts >= 0),
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

CREATE OR REPLACE FUNCTION public.generate_delivery_handoff_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.delivery_handoffs (delivery_id, code)
  VALUES (
    NEW.id,
    lpad((('x' || encode(gen_random_bytes(2), 'hex'))::bit(16)::int % 10000)::text, 4, '0')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_delivery_handoff(
  p_delivery_id uuid,
  p_code text,
  p_proof_photo_path text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider_id uuid;
  v_status delivery_status;
  v_payment_method text;
  v_handoff public.delivery_handoffs%ROWTYPE;
  v_attempts integer;
BEGIN
  SELECT rider_id, status, payment_method
  INTO v_rider_id, v_status, v_payment_method
  FROM public.deliveries
  WHERE id = p_delivery_id;

  IF v_rider_id IS NULL OR v_rider_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to verify this delivery';
  END IF;

  IF v_status <> 'picked_up' THEN
    RAISE EXCEPTION 'Delivery is not in picked_up state';
  END IF;

  SELECT * INTO v_handoff
  FROM public.delivery_handoffs
  WHERE delivery_id = p_delivery_id
  FOR UPDATE;

  IF NOT FOUND OR v_handoff.verified THEN
    RAISE EXCEPTION 'No pending handoff code for this delivery';
  END IF;

  IF v_handoff.locked_until IS NOT NULL AND v_handoff.locked_until > now() THEN
    RAISE EXCEPTION 'Too many failed attempts. Handoff is locked until %', v_handoff.locked_until
      USING ERRCODE = 'P0001';
  END IF;

  IF trim(p_code) = v_handoff.code THEN
    UPDATE public.delivery_handoffs
    SET verified = true,
        verified_at = now(),
        failed_attempts = 0,
        locked_until = NULL
    WHERE delivery_id = p_delivery_id;

    PERFORM set_config('ridely.internal_delivery_update', 'on', true);

    UPDATE public.deliveries
    SET
      status = 'delivered',
      completed_at = now(),
      updated_at = now(),
      proof_photo_path = COALESCE(p_proof_photo_path, proof_photo_path),
      payment_status = CASE
        WHEN v_payment_method = 'cash' THEN 'paid'
        ELSE payment_status
      END,
      amount_paid = CASE
        WHEN v_payment_method = 'cash' THEN total_cost
        ELSE amount_paid
      END
    WHERE id = p_delivery_id;

    UPDATE public.riders
    SET is_available = true, updated_at = now()
    WHERE id = v_rider_id;

    RETURN true;
  END IF;

  UPDATE public.delivery_handoffs
  SET failed_attempts = failed_attempts + 1,
      locked_until = CASE
        WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes'
        ELSE locked_until
      END
  WHERE delivery_id = p_delivery_id
  RETURNING failed_attempts INTO v_attempts;

  IF v_attempts >= 5 THEN
    RAISE EXCEPTION 'Too many failed attempts. Handoff is locked for 15 minutes'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_delivery_handoff(uuid, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Chat: sender_type must match role; only read_at may change
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants can send delivery messages" ON public.delivery_messages;
CREATE POLICY "Participants can send delivery messages" ON public.delivery_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_id
        AND (
          (sender_type = 'user' AND d.user_id = auth.uid())
          OR (sender_type = 'rider' AND d.rider_id = auth.uid())
        )
    )
  );

CREATE OR REPLACE FUNCTION public.protect_delivery_message_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_id IS DISTINCT FROM OLD.delivery_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.sender_type IS DISTINCT FROM OLD.sender_type
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.image_path IS DISTINCT FROM OLD.image_path
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only read_at may be updated on delivery messages'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_protect_delivery_message_columns ON public.delivery_messages;
CREATE TRIGGER trigger_protect_delivery_message_columns
  BEFORE UPDATE ON public.delivery_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_delivery_message_columns();

-- -----------------------------------------------------------------------------
-- 4. Promo codes: clients cannot list active codes (redeem via edge function)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS promo_codes_select_active ON public.promo_codes;
DROP POLICY IF EXISTS promo_codes_deny_all ON public.promo_codes;
CREATE POLICY promo_codes_deny_all
  ON public.promo_codes
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

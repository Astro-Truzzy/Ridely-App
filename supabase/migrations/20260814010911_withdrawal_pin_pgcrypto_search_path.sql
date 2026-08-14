-- pgcrypto lives in the `extensions` schema on hosted Supabase.
-- set_withdrawal_pin / verify_withdrawal_pin used search_path = public only,
-- so crypt() / gen_salt() failed and new users saw "Could not save PIN".

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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

REVOKE ALL ON FUNCTION public.withdrawal_pin_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdrawal_pin_status(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.set_withdrawal_pin(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_withdrawal_pin(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.verify_withdrawal_pin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_withdrawal_pin(uuid, text) TO service_role;

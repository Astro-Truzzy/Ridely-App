-- =============================================================================
-- Self-heal missing customer/rider profile rows.
-- Email-confirmation signups whose handle_new_user trigger silently failed
-- (EXCEPTION WHEN OTHERS THEN RETURN NEW) end up with an auth account but no
-- public.users / public.riders row. The app then shows fallback profile data
-- and create-delivery / payment-init reject the user with
-- "Only customers can create deliveries".
--
-- This RPC lets an authenticated user recreate ONLY their own row
-- (auth.uid()) from their auth metadata. The app calls it on session load
-- when the profile row is missing, and falls back to a direct insert when
-- this migration has not been run yet.
-- Run in Supabase Dashboard → SQL Editor.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ensure_own_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_meta jsonb;
  v_type text;
  v_name text;
  v_phone text;
  v_row jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT au.email, au.raw_user_meta_data
    INTO v_email, v_meta
    FROM auth.users au
   WHERE au.id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth user not found' USING ERRCODE = '02000';
  END IF;

  v_type := COALESCE(v_meta->>'userType', 'user');
  IF v_type <> 'rider' THEN
    v_type := 'user';
  END IF;
  v_name := COALESCE(
    NULLIF(v_meta->>'fullName', ''),
    NULLIF(v_meta->>'full_name', ''),
    NULLIF(v_meta->>'name', ''),
    NULLIF(split_part(COALESCE(v_email, ''), '@', 1), ''),
    'User'
  );
  v_phone := COALESCE(v_meta->>'phone', '');

  BEGIN
    IF v_type = 'rider' THEN
      INSERT INTO public.riders (id, email, full_name, phone)
      VALUES (v_uid, v_email, v_name, v_phone)
      ON CONFLICT (id) DO NOTHING;
      SELECT to_jsonb(r) INTO v_row FROM public.riders r WHERE r.id = v_uid;
    ELSE
      INSERT INTO public.users (id, email, full_name, phone)
      VALUES (v_uid, v_email, v_name, v_phone)
      ON CONFLICT (id) DO NOTHING;
      SELECT to_jsonb(u) INTO v_row FROM public.users u WHERE u.id = v_uid;
    END IF;
  EXCEPTION
    WHEN unique_violation THEN
      -- A conflicting email row from another account: never fail auth for
      -- this, just return whatever row belongs to this user (may be null).
      IF v_type = 'rider' THEN
        SELECT to_jsonb(r) INTO v_row FROM public.riders r WHERE r.id = v_uid;
      ELSE
        SELECT to_jsonb(u) INTO v_row FROM public.users u WHERE u.id = v_uid;
      END IF;
  END;

  RETURN jsonb_build_object('user_type', v_type, 'profile', v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_own_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_own_profile() TO authenticated;

-- =============================================================================
-- Custom Access Token Hook: add user_type (role) to JWT from riders/users tables
-- So the app can read role from session.user.app_metadata.user_type without
-- hitting the DB on every load.
--
-- After running this migration, enable the hook in Supabase Dashboard:
--   Authentication → Hooks → Custom Access Token → Postgres Function
--   Select: public.custom_access_token_hook
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  uid uuid;
  user_type text;
BEGIN
  uid := (event->>'user_id')::uuid;
  claims := event->'claims';

  -- Look up role: rider first, then user (same as app's loadUserProfile)
  IF EXISTS (SELECT 1 FROM public.riders WHERE id = uid) THEN
    user_type := 'rider';
  ELSIF EXISTS (SELECT 1 FROM public.users WHERE id = uid) THEN
    user_type := 'user';
  ELSE
    user_type := NULL;
  END IF;

  -- Add to app_metadata (included in JWT; optional claim)
  IF user_type IS NOT NULL THEN
    claims := jsonb_set(
      COALESCE(claims, '{}'::jsonb),
      '{app_metadata}',
      COALESCE(claims->'app_metadata', '{}'::jsonb) || jsonb_build_object('user_type', user_type)
    );
  END IF;

  RETURN jsonb_build_object('claims', claims);
END;
$$;

-- Required for Supabase Auth to call the hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

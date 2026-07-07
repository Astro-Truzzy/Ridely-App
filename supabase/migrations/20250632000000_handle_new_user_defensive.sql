-- =============================================================================
-- Make handle_new_user defensive so it never fails the auth transaction.
-- "Database error updating user" during signup often happens when this trigger
-- fails (e.g. RLS or constraint); catching exceptions lets auth succeed and the
-- app can create the profile with the user's session.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  user_full_name text;
  user_phone text;
  user_type text;
BEGIN
  user_email := NEW.email;
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'fullName', NEW.raw_user_meta_data->>'full_name', 'User');
  user_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  user_type := COALESCE(NEW.raw_user_meta_data->>'userType', 'user');

  IF NEW.email_confirmed_at IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id)
       AND NOT EXISTS (SELECT 1 FROM public.riders WHERE id = NEW.id) THEN
      IF user_type = 'rider' THEN
        INSERT INTO public.riders (id, email, full_name, phone)
        VALUES (NEW.id, user_email, user_full_name, user_phone)
        ON CONFLICT (id) DO NOTHING;
      ELSE
        INSERT INTO public.users (id, email, full_name, phone)
        VALUES (NEW.id, user_email, user_full_name, user_phone)
        ON CONFLICT (id) DO NOTHING;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Do not fail the auth transaction; the app will create the profile
    -- when it has the session (insert in signUp after signUp returns).
    RETURN NEW;
END;
$$;

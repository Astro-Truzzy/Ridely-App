-- Create a function to automatically create user/rider profile when email is confirmed
-- This handles the case where email confirmation is enabled and profile creation is deferred

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email text;
  user_full_name text;
  user_phone text;
  user_type text;
BEGIN
  -- Get user data from auth.users metadata or raw_user_meta_data
  user_email := NEW.email;
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'fullName', NEW.raw_user_meta_data->>'full_name', 'User');
  user_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  user_type := COALESCE(NEW.raw_user_meta_data->>'userType', 'user');

  -- Only create profile if email is confirmed and user doesn't already have a profile
  IF NEW.email_confirmed_at IS NOT NULL THEN
    -- Check if profile already exists
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) AND
       NOT EXISTS (SELECT 1 FROM public.riders WHERE id = NEW.id) THEN
      
      -- Create profile based on user type
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires when a user's email is confirmed
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- Also create profile on initial user creation if email is already confirmed
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();


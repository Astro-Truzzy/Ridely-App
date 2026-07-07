-- =============================================================================
-- Ridely: Full initial schema for a NEW Supabase database
-- Run this entire file once in Supabase Dashboard → SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Custom types (enums)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN
    CREATE TYPE delivery_status AS ENUM (
      'pending', 'rider_assigned', 'picked_up', 'in_transit', 'nearby', 'delivered', 'cancelled'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'parcel_size') THEN
    CREATE TYPE parcel_size AS ENUM ('small', 'medium', 'large');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
    CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'expired', 'failed');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_time_type') THEN
    CREATE TYPE delivery_time_type AS ENUM ('now', 'scheduled');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM ('job_request', 'payment', 'system', 'delivery_update');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'earning_status') THEN
    CREATE TYPE earning_status AS ENUM ('pending', 'completed', 'paid');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Tables (id = auth.uid() from app; no default on id for users/riders)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  avatar_url text
);

CREATE TABLE IF NOT EXISTS public.riders (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  vehicle_type text,
  plate_number text,
  license_status verification_status DEFAULT 'pending',
  insurance_status verification_status DEFAULT 'pending',
  background_check verification_status DEFAULT 'pending',
  rating numeric DEFAULT 5.0,
  total_deliveries integer DEFAULT 0,
  is_available boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  avatar_url text
);

CREATE TABLE IF NOT EXISTS public.rider_locations (
  rider_id uuid PRIMARY KEY REFERENCES public.riders(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid REFERENCES public.riders(id),
  user_id uuid REFERENCES public.users(id) NOT NULL,
  pickup_address text NOT NULL,
  dropoff_address text NOT NULL,
  parcel_size parcel_size NOT NULL,
  status delivery_status DEFAULT 'pending',
  total_cost numeric NOT NULL,
  distance numeric NOT NULL,
  estimated_time text NOT NULL,
  delivery_time delivery_time_type DEFAULT 'now',
  scheduled_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid REFERENCES public.deliveries(id) NOT NULL,
  rider_id uuid REFERENCES public.riders(id) NOT NULL,
  gross_amount numeric NOT NULL,
  ridely_fee numeric NOT NULL,
  net_amount numeric NOT NULL,
  status earning_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) NOT NULL,
  rider_id uuid REFERENCES public.riders(id),
  type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  actionable boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users: own row only
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own data" ON public.users;
CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
CREATE POLICY "Users can insert own data" ON public.users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Riders: own row only
DROP POLICY IF EXISTS "Riders can read own data" ON public.riders;
CREATE POLICY "Riders can read own data" ON public.riders
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Riders can update own data" ON public.riders;
CREATE POLICY "Riders can update own data" ON public.riders
  FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Riders can insert own data" ON public.riders;
CREATE POLICY "Riders can insert own data" ON public.riders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Users can read riders who are assigned to their deliveries
DROP POLICY IF EXISTS "Users can read rider data for deliveries" ON public.riders;
CREATE POLICY "Users can read rider data for deliveries" ON public.riders
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.rider_id = riders.id AND d.user_id = auth.uid()
    )
  );

-- Deliveries: users manage own; riders read/update assigned or claim pending
DROP POLICY IF EXISTS "Users can read own deliveries" ON public.deliveries;
CREATE POLICY "Users can read own deliveries" ON public.deliveries
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own deliveries" ON public.deliveries;
CREATE POLICY "Users can insert own deliveries" ON public.deliveries
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own deliveries" ON public.deliveries;
CREATE POLICY "Users can update own deliveries" ON public.deliveries
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Riders can read assigned deliveries" ON public.deliveries;
CREATE POLICY "Riders can read assigned deliveries" ON public.deliveries
  FOR SELECT TO authenticated USING (rider_id = auth.uid());

DROP POLICY IF EXISTS "Riders can read available deliveries" ON public.deliveries;
CREATE POLICY "Riders can read available deliveries" ON public.deliveries
  FOR SELECT TO authenticated USING (status = 'pending' AND rider_id IS NULL);

-- Riders can update deliveries they are assigned to
DROP POLICY IF EXISTS "Riders can update assigned deliveries" ON public.deliveries;
CREATE POLICY "Riders can update assigned deliveries" ON public.deliveries
  FOR UPDATE TO authenticated USING (rider_id = auth.uid()) WITH CHECK (rider_id = auth.uid());

-- Riders can claim a pending delivery (set rider_id and status)
DROP POLICY IF EXISTS "Riders can claim pending deliveries" ON public.deliveries;
CREATE POLICY "Riders can claim pending deliveries" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (status = 'pending' AND rider_id IS NULL)
  WITH CHECK (rider_id = auth.uid());

-- Earnings: riders see and insert own
DROP POLICY IF EXISTS "Riders can read own earnings" ON public.earnings;
CREATE POLICY "Riders can read own earnings" ON public.earnings
  FOR SELECT TO authenticated USING (rider_id = auth.uid());

DROP POLICY IF EXISTS "Riders can insert own earnings" ON public.earnings;
CREATE POLICY "Riders can insert own earnings" ON public.earnings
  FOR INSERT TO authenticated WITH CHECK (rider_id = auth.uid());

-- Notifications: users and riders by user_id / rider_id
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Riders can read own notifications" ON public.notifications;
CREATE POLICY "Riders can read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (rider_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Riders can update own notifications" ON public.notifications;
CREATE POLICY "Riders can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (rider_id = auth.uid());

-- Rider locations: rider upserts own; user can read when they have an active delivery with that rider
DROP POLICY IF EXISTS "Rider can upsert own location" ON public.rider_locations;
CREATE POLICY "Rider can upsert own location" ON public.rider_locations
  FOR ALL TO authenticated USING (rider_id = auth.uid()) WITH CHECK (rider_id = auth.uid());

DROP POLICY IF EXISTS "Rider or delivery user can select location" ON public.rider_locations;
CREATE POLICY "Rider or delivery user can select location" ON public.rider_locations
  FOR SELECT TO authenticated USING (
    rider_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.rider_id = rider_locations.rider_id
        AND d.user_id = auth.uid()
        AND d.status IN ('rider_assigned', 'picked_up', 'in_transit', 'nearby')
    )
  );

-- -----------------------------------------------------------------------------
-- 4. Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_rider_id ON public.deliveries(rider_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_user_id ON public.deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_riders_available ON public.riders(is_available);
CREATE INDEX IF NOT EXISTS idx_earnings_rider_id ON public.earnings(rider_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_rider_id ON public.notifications(rider_id);

-- -----------------------------------------------------------------------------
-- 5. updated_at trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_users_updated_at ON public.users;
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_riders_updated_at ON public.riders;
CREATE TRIGGER trigger_riders_updated_at
  BEFORE UPDATE ON public.riders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_deliveries_updated_at ON public.deliveries;
CREATE TRIGGER trigger_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_earnings_updated_at ON public.earnings;
CREATE TRIGGER trigger_earnings_updated_at
  BEFORE UPDATE ON public.earnings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_rider_locations_updated_at ON public.rider_locations;
CREATE TRIGGER trigger_rider_locations_updated_at
  BEFORE UPDATE ON public.rider_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 6. Auto earnings when delivery is delivered
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_earnings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status <> 'delivered') AND NEW.rider_id IS NOT NULL THEN
    INSERT INTO public.earnings (delivery_id, rider_id, gross_amount, ridely_fee, net_amount, status)
    VALUES (
      NEW.id,
      NEW.rider_id,
      NEW.total_cost,
      NEW.total_cost * 0.15,
      NEW.total_cost * 0.85,
      'completed'
    );
    UPDATE public.riders
    SET total_deliveries = total_deliveries + 1, updated_at = now()
    WHERE id = NEW.rider_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_earnings ON public.deliveries;
CREATE TRIGGER trigger_calculate_earnings
  AFTER UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.calculate_earnings();

-- -----------------------------------------------------------------------------
-- 7. Auto-create user/rider profile on signup (email confirm or immediate)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 8. Realtime for rider_locations – customers see rider location live
-- -----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.rider_locations;

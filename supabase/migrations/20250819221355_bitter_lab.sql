-- Rider Locations Table for Real-Time Tracking
create table if not exists public.rider_locations (
  rider_id uuid primary key references public.riders(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  updated_at timestamptz not null default now()
);

-- Enable Realtime on this table
-- alter publication supabase_realtime add table public.rider_locations;
/*
  # Initial Ridely Database Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `full_name` (text)
      - `phone` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `riders`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, unique)
      - `full_name` (text)
      - `phone` (text)
      - `vehicle_type` (text, nullable)
      - `plate_number` (text, nullable)
      - `license_status` (enum: pending, verified, expired)
      - `insurance_status` (enum: pending, verified, expired)
      - `background_check` (enum: pending, verified, failed)
      - `rating` (numeric, default 5.0)
      - `total_deliveries` (integer, default 0)
      - `is_available` (boolean, default false)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `deliveries`
      - `id` (uuid, primary key)
      - `rider_id` (uuid, nullable, references riders)
      - `user_id` (uuid, references users)
      - `pickup_address` (text)
      - `dropoff_address` (text)
      - `parcel_size` (enum: small, medium, large)
      - `status` (enum: pending, rider_assigned, picked_up, in_transit, delivered, cancelled)
      - `total_cost` (numeric)
      - `distance` (numeric)
      - `estimated_time` (text)
      - `delivery_time` (enum: now, scheduled)
      - `scheduled_time` (timestamp, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `completed_at` (timestamp, nullable)
    
    - `earnings`
      - `id` (uuid, primary key)
      - `delivery_id` (uuid, references deliveries)
      - `rider_id` (uuid, references riders)
      - `gross_amount` (numeric)
      - `ridely_fee` (numeric)
      - `net_amount` (numeric)
      - `status` (enum: pending, completed, paid)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `rider_id` (uuid, nullable, references riders)
      - `type` (enum: job_request, payment, system, delivery_update)
      - `title` (text)
      - `message` (text)
      - `read` (boolean, default false)
      - `actionable` (boolean, default false)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Add policies for riders to access delivery-related data
*/

-- Create custom types
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN
    CREATE TYPE delivery_status AS ENUM ('pending', 'rider_assigned', 'picked_up', 'in_transit', 'nearby', 'delivered', 'cancelled');
  END IF;
END $$;

-- Add 'nearby' to delivery_status enum if not already present (for existing DBs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'nearby' AND enumtypid = (
      SELECT oid FROM pg_type WHERE typname = 'delivery_status'
    )
  ) THEN
    ALTER TYPE delivery_status ADD VALUE 'nearby';
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

-- Users table
-- CREATE TABLE users (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   email text UNIQUE NOT NULL,
--   full_name text NOT NULL,
--   phone text NOT NULL,
--   created_at timestamptz DEFAULT now(),
--   updated_at timestamptz DEFAULT now()
-- );

-- Riders table
-- CREATE TABLE riders (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   email text UNIQUE NOT NULL,
--   full_name text NOT NULL,
--   phone text NOT NULL,
--   vehicle_type text,
--   plate_number text,
--   license_status verification_status DEFAULT 'pending',
--   insurance_status verification_status DEFAULT 'pending',
--   background_check verification_status DEFAULT 'pending',
--   rating numeric DEFAULT 5.0,
--   total_deliveries integer DEFAULT 0,
--   is_available boolean DEFAULT false,
--   created_at timestamptz DEFAULT now(),
--   updated_at timestamptz DEFAULT now()
-- );

-- Deliveries table
-- CREATE TABLE deliveries (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   rider_id uuid REFERENCES riders(id),
--   user_id uuid REFERENCES users(id) NOT NULL,
--   pickup_address text NOT NULL,
--   dropoff_address text NOT NULL,
--   parcel_size parcel_size NOT NULL,
--   status delivery_status DEFAULT 'pending',
--   total_cost numeric NOT NULL,
--   distance numeric NOT NULL,
--   estimated_time text NOT NULL,
--   delivery_time delivery_time_type DEFAULT 'now',
--   scheduled_time timestamptz,
--   created_at timestamptz DEFAULT now(),
--   updated_at timestamptz DEFAULT now(),
--   completed_at timestamptz
-- );

-- Earnings table
-- CREATE TABLE earnings (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   delivery_id uuid REFERENCES deliveries(id) NOT NULL,
--   rider_id uuid REFERENCES riders(id) NOT NULL,
--   gross_amount numeric NOT NULL,
--   ridely_fee numeric NOT NULL,
--   net_amount numeric NOT NULL,
--   status earning_status DEFAULT 'pending',
--   created_at timestamptz DEFAULT now(),
--   updated_at timestamptz DEFAULT now()
-- );

-- Notifications table
-- CREATE TABLE notifications (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id uuid REFERENCES users(id) NOT NULL,
--   rider_id uuid REFERENCES riders(id),
--   type notification_type NOT NULL,
--   title text NOT NULL,
--   message text NOT NULL,
--   read boolean DEFAULT false,
--   actionable boolean DEFAULT false,
--   created_at timestamptz DEFAULT now()
-- );

-- Create the rider_locations table for real-time tracking
-- CREATE TABLE public.rider_locations (
--   rider_id uuid PRIMARY KEY REFERENCES public.riders(id) ON DELETE CASCADE,
--   latitude double precision NOT NULL,
--   longitude double precision NOT NULL,
--   updated_at timestamptz NOT NULL DEFAULT now()
-- );

-- Enable Realtime on this table (in Supabase dashboard: Database > Replication > Add table to publication)
-- Or run this SQL if needed:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.rider_locations;

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_locations ENABLE ROW LEVEL SECURITY;

-- Users policies
-- Users policies
DROP POLICY IF EXISTS "Users can read own data" ON users;
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Users can insert own data" ON users;
CREATE POLICY "Users can insert own data"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = id::text);

-- Riders policies
-- Riders policies
DROP POLICY IF EXISTS "Riders can read own data" ON riders;
CREATE POLICY "Riders can read own data"
  ON riders
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Riders can update own data" ON riders;
CREATE POLICY "Riders can update own data"
  ON riders
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Riders can insert own data" ON riders;
CREATE POLICY "Riders can insert own data"
  ON riders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Users can read rider data for deliveries" ON riders;
CREATE POLICY "Users can read rider data for deliveries"
  ON riders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deliveries 
      WHERE deliveries.rider_id = riders.id 
      AND deliveries.user_id::text = auth.uid()::text
    )
  );

-- Deliveries policies
-- Deliveries policies
DROP POLICY IF EXISTS "Users can read own deliveries" ON deliveries;
CREATE POLICY "Users can read own deliveries"
  ON deliveries
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert own deliveries" ON deliveries;
CREATE POLICY "Users can insert own deliveries"
  ON deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can update own deliveries" ON deliveries;
CREATE POLICY "Users can update own deliveries"
  ON deliveries
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Riders can read assigned deliveries" ON deliveries;
CREATE POLICY "Riders can read assigned deliveries"
  ON deliveries
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = rider_id::text);

DROP POLICY IF EXISTS "Riders can update assigned deliveries" ON deliveries;
CREATE POLICY "Riders can update assigned deliveries"
  ON deliveries
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = rider_id::text);

DROP POLICY IF EXISTS "Riders can read available deliveries" ON deliveries;
CREATE POLICY "Riders can read available deliveries"
  ON deliveries
  FOR SELECT
  TO authenticated
  USING (status = 'pending' AND rider_id IS NULL);

-- Earnings policies
-- Earnings policies
DROP POLICY IF EXISTS "Riders can read own earnings" ON earnings;
CREATE POLICY "Riders can read own earnings"
  ON earnings
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = rider_id::text);

DROP POLICY IF EXISTS "Riders can insert own earnings" ON earnings;
CREATE POLICY "Riders can insert own earnings"
  ON earnings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = rider_id::text);

-- Notifications policies
-- Notifications policies
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Riders can read own notifications" ON notifications;
CREATE POLICY "Riders can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = rider_id::text);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Riders can update own notifications" ON notifications;
CREATE POLICY "Riders can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = rider_id::text);

-- Enable RLS
alter table public.rider_locations enable row level security;

-- Allow riders to insert/update their own location
-- Rider Locations policies
DROP POLICY IF EXISTS "Rider can upsert own location" ON public.rider_locations;
create policy "Rider can upsert own location"
  on public.rider_locations
  for all
  using (auth.uid()::uuid = rider_id)
  with check (auth.uid()::uuid = rider_id);

-- (Optional) Allow only authenticated users to select (view) locations
DROP POLICY IF EXISTS "Rider or delivery user can select location" ON public.rider_locations;
CREATE POLICY "Rider or delivery user can select location"
  ON public.rider_locations
  FOR SELECT
  USING (
    -- Rider can see their own location
    auth.uid()::uuid = rider_id
    OR
    -- User assigned to a delivery with this rider can see the location
    EXISTS (
      SELECT 1 FROM deliveries
      WHERE deliveries.rider_id = rider_locations.rider_id
        AND deliveries.user_id::text = auth.uid()::text
        AND deliveries.status IN ('rider_assigned', 'picked_up', 'in_transit', 'nearby')
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_rider_id ON deliveries(rider_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_user_id ON deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_riders_available ON riders(is_available);
CREATE INDEX IF NOT EXISTS idx_earnings_rider_id ON earnings(rider_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_rider_id ON notifications(rider_id);

-- Function to automatically calculate earnings when delivery is completed
CREATE OR REPLACE FUNCTION calculate_earnings()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate earnings when status changes to 'delivered'
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    INSERT INTO earnings (
      delivery_id,
      rider_id,
      gross_amount,
      ridely_fee,
      net_amount,
      status
    ) VALUES (
      NEW.id,
      NEW.rider_id,
      NEW.total_cost,
      NEW.total_cost * 0.15, -- 15% Ridely fee
      NEW.total_cost * 0.85, -- 85% to rider
      'completed'
    );
    
    -- Update rider's total deliveries and rating
    UPDATE riders 
    SET 
      total_deliveries = total_deliveries + 1,
      updated_at = now()
    WHERE id = NEW.rider_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic earnings calculation
-- Drop triggers if they exist before creating
DROP TRIGGER IF EXISTS trigger_calculate_earnings ON deliveries;
CREATE TRIGGER trigger_calculate_earnings
  AFTER UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION calculate_earnings();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_riders_updated_at ON riders;
CREATE TRIGGER trigger_riders_updated_at
  BEFORE UPDATE ON riders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_deliveries_updated_at ON deliveries;
CREATE TRIGGER trigger_deliveries_updated_at
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_earnings_updated_at ON earnings;
CREATE TRIGGER trigger_earnings_updated_at
  BEFORE UPDATE ON earnings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_rider_locations_updated_at ON rider_locations;
CREATE TRIGGER trigger_rider_locations_updated_at
  BEFORE UPDATE ON rider_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


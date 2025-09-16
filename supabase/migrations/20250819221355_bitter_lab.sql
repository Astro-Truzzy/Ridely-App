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
CREATE TYPE delivery_status AS ENUM ('pending', 'rider_assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled');
CREATE TYPE parcel_size AS ENUM ('small', 'medium', 'large');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'expired', 'failed');
CREATE TYPE delivery_time_type AS ENUM ('now', 'scheduled');
CREATE TYPE notification_type AS ENUM ('job_request', 'payment', 'system', 'delivery_update');
CREATE TYPE earning_status AS ENUM ('pending', 'completed', 'paid');

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Riders table
CREATE TABLE IF NOT EXISTS riders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  updated_at timestamptz DEFAULT now()
);

-- Deliveries table
CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid REFERENCES riders(id),
  user_id uuid REFERENCES users(id) NOT NULL,
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

-- Earnings table
CREATE TABLE IF NOT EXISTS earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid REFERENCES deliveries(id) NOT NULL,
  rider_id uuid REFERENCES riders(id) NOT NULL,
  gross_amount numeric NOT NULL,
  ridely_fee numeric NOT NULL,
  net_amount numeric NOT NULL,
  status earning_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  rider_id uuid REFERENCES riders(id),
  type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  actionable boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text);

CREATE POLICY "Users can insert own data"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = id::text);

-- Riders policies
CREATE POLICY "Riders can read own data"
  ON riders
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

CREATE POLICY "Riders can update own data"
  ON riders
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text);

CREATE POLICY "Riders can insert own data"
  ON riders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = id::text);

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
CREATE POLICY "Users can read own deliveries"
  ON deliveries
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own deliveries"
  ON deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own deliveries"
  ON deliveries
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Riders can read assigned deliveries"
  ON deliveries
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = rider_id::text);

CREATE POLICY "Riders can update assigned deliveries"
  ON deliveries
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = rider_id::text);

CREATE POLICY "Riders can read available deliveries"
  ON deliveries
  FOR SELECT
  TO authenticated
  USING (status = 'pending' AND rider_id IS NULL);

-- Earnings policies
CREATE POLICY "Riders can read own earnings"
  ON earnings
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = rider_id::text);

CREATE POLICY "Riders can insert own earnings"
  ON earnings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = rider_id::text);

-- Notifications policies
CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Riders can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = rider_id::text);

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Riders can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = rider_id::text);

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
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_riders_updated_at
  BEFORE UPDATE ON riders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_deliveries_updated_at
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_earnings_updated_at
  BEFORE UPDATE ON earnings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

const { data, error } = await supabase
  .from('users')
  .insert([{ id: user.id, email, full_name, phone }]);
-- =============================================================================
-- PostGIS + delivery flow: riders.location, is_online, new status values, RPC
-- Run after 20250618000000_ridely_initial_schema.sql
-- =============================================================================

-- 1. PostGIS extension (install in extensions schema — keeps spatial_ref_sys out of public API)
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- 2. Riders: is_online and location (geography) for proximity matching
ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

-- 3. Delivery status: add accepted, completed, cancelled_no_rider (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'delivery_status' AND e.enumlabel = 'accepted') THEN
    ALTER TYPE delivery_status ADD VALUE 'accepted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'delivery_status' AND e.enumlabel = 'completed') THEN
    ALTER TYPE delivery_status ADD VALUE 'completed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'delivery_status' AND e.enumlabel = 'cancelled_no_rider') THEN
    ALTER TYPE delivery_status ADD VALUE 'cancelled_no_rider';
  END IF;
END $$;

-- 4. Earnings trigger: fire on 'delivered' OR 'completed'
CREATE OR REPLACE FUNCTION public.calculate_earnings()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'delivered' OR NEW.status = 'completed')
     AND (OLD.status IS NULL OR OLD.status <> 'delivered' AND OLD.status <> 'completed')
     AND NEW.rider_id IS NOT NULL THEN
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

-- 5. find_nearby_riders RPC (SECURITY DEFINER so any authenticated user can call)
CREATE OR REPLACE FUNCTION public.find_nearby_riders(
  pickup_lat float,
  pickup_lng float,
  radius int DEFAULT 5000
)
RETURNS TABLE (
  id uuid,
  distance float
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT r.id,
    ST_Distance(
      r.location::geography,
      ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography
    )::float as distance
  FROM public.riders r
  WHERE r.is_online = true
    AND r.is_available = true
    AND r.location IS NOT NULL
    AND ST_DWithin(
      r.location::geography,
      ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography,
      radius
    )
  ORDER BY distance ASC;
$$;

-- 6. Notifications: users can insert job_request for riders (user_id = self, rider_id = target)
DROP POLICY IF EXISTS "Users can insert notifications for riders" ON public.notifications;
CREATE POLICY "Users can insert notifications for riders" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND rider_id IS NOT NULL);

COMMENT ON FUNCTION public.find_nearby_riders(float, float, int) IS
  'Returns riders within radius (meters) of pickup, ordered by distance. Requires PostGIS and riders.location, is_online, is_available.';

-- 7. RPC for rider app to set own location (geography) without sending WKT from client
CREATE OR REPLACE FUNCTION public.update_rider_location(lat float, lng float)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.riders
  SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      updated_at = now()
  WHERE id = auth.uid();
END;
$$;

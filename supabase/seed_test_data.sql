-- =============================================================================
-- Ridely: Test data for development
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================
-- BEFORE RUNNING:
-- 1. Get your user UUID: Supabase Dashboard → Authentication → Users → copy your user id
-- 2. Replace YOUR_USER_ID below with that UUID (keep the quotes)
-- 3. Run this entire script once
-- =============================================================================

-- Test rider (for active delivery and tracking map; no auth account needed)
INSERT INTO public.riders (
  id,
  email,
  full_name,
  phone,
  vehicle_type,
  plate_number,
  license_status,
  insurance_status,
  background_check,
  rating,
  total_deliveries,
  is_available,
  created_at,
  updated_at
) VALUES (
  'a1b2c3d4-e5f6-4789-a012-345678901234',
  'rider.test@ridely.dev',
  'Test Rider',
  '+2348012345678',
  'Motorcycle',
  'ABC-123-XY',
  'verified',
  'verified',
  'verified',
  4.8,
  42,
  true,
  now() - interval '30 days',
  now()
) ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  updated_at = now();

-- Rider location (Lagos) – so tracking map shows a pin
INSERT INTO public.rider_locations (rider_id, latitude, longitude, updated_at)
VALUES (
  'a1b2c3d4-e5f6-4789-a012-345678901234',
  6.5244,
  3.3792,
  now()
) ON CONFLICT (rider_id) DO UPDATE SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  updated_at = now();

-- Deliveries for your user (replace :user_id in app or use the variable below)
-- In SQL Editor you must replace YOUR_USER_ID manually before running.

-- 1) Active delivery (in_transit) – use this to test Tracking screen and map
INSERT INTO public.deliveries (
  id, user_id, rider_id, pickup_address, dropoff_address, parcel_size,
  status, total_cost, distance, estimated_time, delivery_time, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '6161dbfc-1933-4abb-b396-fe8883abab7e',
  'a1b2c3d4-e5f6-4789-a012-345678901234',
  '12 Admiralty Way, Lekki Phase 1, Lagos',
  '45 Isaac John St, GRA, Ikeja, Lagos',
  'medium',
  'in_transit',
  3500,
  18.5,
  '35 mins',
  'now',
  now() - interval '2 hours',
  now()
) ON CONFLICT (id) DO NOTHING;

-- 2) Pending delivery – test “Cancel delivery” and My Bookings
INSERT INTO public.deliveries (
  id, user_id, rider_id, pickup_address, dropoff_address, parcel_size,
  status, total_cost, distance, estimated_time, delivery_time, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '6161dbfc-1933-4abb-b396-fe8883abab7e',
  NULL,
  'Shop 3, Ajah Market, Lagos',
  'Victoria Island, Lagos',
  'small',
  'pending',
  1200,
  8.2,
  '20 mins',
  'now',
  now() - interval '30 minutes',
  now()
) ON CONFLICT (id) DO NOTHING;

-- 3) Recent delivered
INSERT INTO public.deliveries (
  id, user_id, rider_id, pickup_address, dropoff_address, parcel_size,
  status, total_cost, distance, estimated_time, delivery_time, completed_at, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '6161dbfc-1933-4abb-b396-fe8883abab7e',
  'a1b2c3d4-e5f6-4789-a012-345678901234',
  '15 Ozumba Mbadiwe Ave, Victoria Island, Lagos',
  '7 Adeola Odeku St, Victoria Island, Lagos',
  'small',
  'delivered',
  2500,
  5.1,
  '15 mins',
  'now',
  now() - interval '1 day',
  now() - interval '1 day',
  now()
) ON CONFLICT (id) DO NOTHING;

-- 4) Another delivered (for “recent deliveries” on home)
INSERT INTO public.deliveries (
  id, user_id, rider_id, pickup_address, dropoff_address, parcel_size,
  status, total_cost, distance, estimated_time, delivery_time, completed_at, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '6161dbfc-1933-4abb-b396-fe8883abab7e',
  'a1b2c3d4-e5f6-4789-a012-345678901234',
  '22 Adeola Hopewell St, VI, Lagos',
  'Lekki-Epe Expressway, Lekki, Lagos',
  'large',
  'delivered',
  6200,
  22.0,
  '45 mins',
  'now',
  now() - interval '3 days',
  now() - interval '3 days',
  now()
) ON CONFLICT (id) DO NOTHING;

-- 5) Cancelled – test Cancelled tab in My Bookings
INSERT INTO public.deliveries (
  id, user_id, rider_id, pickup_address, dropoff_address, parcel_size,
  status, total_cost, distance, estimated_time, delivery_time, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '6161dbfc-1933-4abb-b396-fe8883abab7e',
  NULL,
  '1 Muri Okunola St, VI, Lagos',
  'Alausa, Ikeja, Lagos',
  'medium',
  'cancelled',
  2800,
  14.0,
  '30 mins',
  'now',
  now() - interval '5 days',
  now()
) ON CONFLICT (id) DO NOTHING;

-- 6) Notifications for the user
INSERT INTO public.notifications (user_id, type, title, message, read, actionable, created_at)
VALUES
  ('6161dbfc-1933-4abb-b396-fe8883abab7e', 'delivery_update', 'Delivery in progress', 'Your package is on the way. Track live on the map.', false, true, now()),
  ('6161dbfc-1933-4abb-b396-fe8883abab7e', 'system', 'Welcome to Ridely', 'Tap Book Delivery to send your first package.', true, false, now() - interval '1 hour');

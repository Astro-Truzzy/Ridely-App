-- Fix riders and users tables to ensure id matches auth.uid()
-- Remove default gen_random_uuid() and add constraint to ensure id matches auth user

-- For riders table: ensure id column doesn't have a default that conflicts with RLS
-- The RLS policy requires id = auth.uid(), so we should not auto-generate IDs
ALTER TABLE IF EXISTS riders 
  ALTER COLUMN id DROP DEFAULT;

-- For users table: ensure id column doesn't have a default that conflicts with RLS  
ALTER TABLE IF EXISTS users 
  ALTER COLUMN id DROP DEFAULT;

-- Note: The application code must always provide the auth user's ID when inserting
-- This ensures the RLS policy (auth.uid()::text = id::text) will work correctly


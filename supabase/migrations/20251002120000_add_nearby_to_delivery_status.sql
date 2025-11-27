-- Migration: Add 'nearby' value to delivery_status enum (must be run and committed before any code uses 'nearby')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'delivery_status' AND e.enumlabel = 'nearby'
  ) THEN
    ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'nearby';
  END IF;
END
$$ LANGUAGE plpgsql;
-- =============================================================================
-- Delivery coords, share tokens, and proof photo path for new features.
-- =============================================================================

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS pickup_lat double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng double precision,
  ADD COLUMN IF NOT EXISTS dropoff_lat double precision,
  ADD COLUMN IF NOT EXISTS dropoff_lng double precision,
  ADD COLUMN IF NOT EXISTS share_token uuid DEFAULT gen_random_uuid() NOT NULL,
  ADD COLUMN IF NOT EXISTS proof_photo_path text;

-- Backfill share_token for any legacy rows (should be covered by DEFAULT)
UPDATE public.deliveries SET share_token = gen_random_uuid() WHERE share_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_share_token ON public.deliveries(share_token);

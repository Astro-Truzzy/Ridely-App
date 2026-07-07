-- =============================================================================
-- Delivery ratings: users can rate and optionally review after a delivery.
-- One rating per delivery. Rider's average rating is updated via trigger.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.delivery_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_ratings_user_id ON public.delivery_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_ratings_rider_id ON public.delivery_ratings(rider_id);

ALTER TABLE public.delivery_ratings ENABLE ROW LEVEL SECURITY;

-- Users can insert a rating for a delivery they own (user_id on delivery = auth.uid())
CREATE POLICY delivery_ratings_insert_own
  ON public.delivery_ratings FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_id AND d.user_id = auth.uid()
    )
  );

-- Users can read their own ratings
CREATE POLICY delivery_ratings_select_own
  ON public.delivery_ratings FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Riders can read ratings for their own rider_id (to show on profile)
CREATE POLICY delivery_ratings_select_rider
  ON public.delivery_ratings FOR SELECT TO authenticated
  USING (rider_id = auth.uid());

-- No update/delete for simplicity (ratings are final)
-- COMMENT: To allow edit, add UPDATE policy with user_id = auth.uid().

-- Trigger: when a new rating is inserted, update the rider's average rating
CREATE OR REPLACE FUNCTION public.delivery_ratings_update_rider_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.riders r
  SET
    rating = (
      SELECT ROUND(AVG(dr.rating)::numeric, 2)::numeric
      FROM public.delivery_ratings dr
      WHERE dr.rider_id = NEW.rider_id
    ),
    updated_at = now()
  WHERE r.id = NEW.rider_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS delivery_ratings_after_insert ON public.delivery_ratings;
CREATE TRIGGER delivery_ratings_after_insert
  AFTER INSERT ON public.delivery_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.delivery_ratings_update_rider_rating();

-- Per-rider delivery rejections: a rider can reject a pending delivery so it no
-- longer shows to them, while remaining available to other riders.

CREATE TABLE IF NOT EXISTS public.delivery_rejections (
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (delivery_id, rider_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_rejections_rider_id
  ON public.delivery_rejections(rider_id);

ALTER TABLE public.delivery_rejections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Riders can read own rejections" ON public.delivery_rejections;
CREATE POLICY "Riders can read own rejections" ON public.delivery_rejections
  FOR SELECT TO authenticated USING (rider_id = auth.uid());

DROP POLICY IF EXISTS "Riders can insert own rejections" ON public.delivery_rejections;
CREATE POLICY "Riders can insert own rejections" ON public.delivery_rejections
  FOR INSERT TO authenticated WITH CHECK (rider_id = auth.uid());

DROP POLICY IF EXISTS "Riders can delete own rejections" ON public.delivery_rejections;
CREATE POLICY "Riders can delete own rejections" ON public.delivery_rejections
  FOR DELETE TO authenticated USING (rider_id = auth.uid());

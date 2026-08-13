-- Allow customers to read rider location while delivery is accepted (not only later statuses).
DROP POLICY IF EXISTS "Rider or delivery user can select location" ON public.rider_locations;
CREATE POLICY "Rider or delivery user can select location" ON public.rider_locations
  FOR SELECT TO authenticated USING (
    rider_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.rider_id = rider_locations.rider_id
        AND d.user_id = auth.uid()
        AND d.status IN ('rider_assigned', 'accepted', 'picked_up', 'in_transit', 'nearby')
    )
  );

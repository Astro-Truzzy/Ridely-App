-- Allow riders to insert delivery_update notifications for the customer (user) on deliveries they are assigned to
CREATE POLICY "Riders can insert notifications for users" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    rider_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.rider_id = auth.uid()
        AND d.user_id = notifications.user_id
        AND (notifications.delivery_id IS NULL OR d.id = notifications.delivery_id)
    )
  );

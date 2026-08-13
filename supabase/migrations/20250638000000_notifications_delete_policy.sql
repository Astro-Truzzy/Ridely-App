-- Allow users and riders to delete their own notifications.

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Riders can delete own notifications" ON public.notifications;
CREATE POLICY "Riders can delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (rider_id = auth.uid());

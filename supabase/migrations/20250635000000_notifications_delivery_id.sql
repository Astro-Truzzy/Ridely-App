-- Add delivery_id to notifications so rider delivery-request popups can show details and Accept/Reject
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS delivery_id uuid REFERENCES public.deliveries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_delivery_id ON public.notifications(delivery_id)
  WHERE delivery_id IS NOT NULL;

COMMENT ON COLUMN public.notifications.delivery_id IS 'For job_request type: the delivery this notification is about.';

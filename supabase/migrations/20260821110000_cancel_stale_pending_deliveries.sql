-- Auto-cancel stale pending deliveries without tripping the status-transition trigger.
-- Edge functions call this with the service role after authenticating the customer.

CREATE OR REPLACE FUNCTION public.cancel_stale_pending_deliveries(
  p_delivery_id uuid DEFAULT NULL,
  p_owner_user_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('ridely.internal_delivery_update', 'on', true);

  RETURN QUERY
  UPDATE public.deliveries d
  SET status = 'cancelled_no_rider'
  WHERE d.status = 'pending'
    AND d.rider_id IS NULL
    AND d.created_at < (now() - interval '2 minutes')
    AND (p_delivery_id IS NULL OR d.id = p_delivery_id)
    AND (p_owner_user_id IS NULL OR d.user_id = p_owner_user_id)
  RETURNING d.id, d.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_stale_pending_deliveries(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_stale_pending_deliveries(uuid, uuid) TO service_role;

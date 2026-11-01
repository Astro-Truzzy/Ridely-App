-- =============================================================================
-- Phase 4: payment-before-dispatch enforcement in accept_delivery().
-- A delivery cannot be claimed by any rider until its payment is backend-
-- verified (payment_status = 'paid'). Unpaid, pending, and failed deliveries
-- stay invisible to riders; the client job feed filters on the same rule, but
-- this RPC is the authoritative backend gate (direct RPC calls are rejected).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.accept_delivery(p_delivery_id uuid)
RETURNS public.deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status rider_account_verification_status;
  v_payment_status text;
  v_row public.deliveries;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT account_verification_status INTO v_status
  FROM public.riders
  WHERE id = v_uid;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Only riders can accept deliveries' USING ERRCODE = '42501';
  END IF;

  IF v_status <> 'verified' THEN
    RAISE EXCEPTION 'Rider must be verified to accept deliveries'
      USING ERRCODE = '42501';
  END IF;

  -- Payment gate: backend-verified payment only. Cash-on-delivery is retired
  -- for new bookings; legacy cash rows can never reach 'paid' for new work
  -- because create-delivery rejects them.
  SELECT payment_status INTO v_payment_status
  FROM public.deliveries
  WHERE id = p_delivery_id;

  IF v_payment_status IS NULL THEN
    RAISE EXCEPTION 'Delivery already accepted or not available';
  END IF;

  IF v_payment_status IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'Payment not verified for this delivery'
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('ridely.internal_delivery_update', 'on', true);

  UPDATE public.deliveries
  SET
    rider_id = v_uid,
    status = 'accepted',
    updated_at = now()
  WHERE id = p_delivery_id
    AND status = 'pending'
    AND rider_id IS NULL
    AND payment_status = 'paid'
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Delivery already accepted or not available';
  END IF;

  UPDATE public.riders
  SET is_available = false, updated_at = now()
  WHERE id = v_uid;

  RETURN v_row;
END;
$$;

-- GRANTs persist across CREATE OR REPLACE, restated for clarity.
GRANT EXECUTE ON FUNCTION public.accept_delivery(uuid) TO authenticated;

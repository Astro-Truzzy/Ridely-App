-- Status machine, payment-gated earnings, cash settlement on handoff.

-- 1. Unique earnings per delivery (dedupe first if needed)
DELETE FROM public.earnings a
  USING public.earnings b
WHERE a.delivery_id = b.delivery_id
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_earnings_delivery_id
  ON public.earnings (delivery_id);

-- 2. Status transition guard
CREATE OR REPLACE FUNCTION public.enforce_delivery_status_transitions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bypass text;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  bypass := current_setting('ridely.internal_delivery_update', true);
  IF bypass = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    -- Still block illegal rider_id changes outside claim path
    IF NEW.rider_id IS DISTINCT FROM OLD.rider_id THEN
      RAISE EXCEPTION 'Cannot reassign delivery rider'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Customer or rider: cancel only (non-terminal -> cancelled)
  IF NEW.status = 'cancelled' THEN
    IF OLD.status IN ('delivered', 'completed', 'cancelled', 'cancelled_no_rider') THEN
      RAISE EXCEPTION 'Cannot cancel a terminal delivery'
        USING ERRCODE = '42501';
    END IF;
    IF NOT (
      OLD.user_id = auth.uid()
      OR OLD.rider_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Not allowed to cancel this delivery'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Rider: accepted|rider_assigned -> picked_up
  IF NEW.status = 'picked_up'
     AND OLD.status IN ('accepted', 'rider_assigned')
     AND OLD.rider_id = auth.uid()
     AND NEW.rider_id = OLD.rider_id
  THEN
    RETURN NEW;
  END IF;

  -- pending -> accepted only via accept_delivery (bypass flag)
  -- picked_up -> delivered only via verify_delivery_handoff (bypass flag)
  RAISE EXCEPTION 'Illegal delivery status transition: % -> %', OLD.status, NEW.status
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_delivery_status_transitions ON public.deliveries;
CREATE TRIGGER trigger_enforce_delivery_status_transitions
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_delivery_status_transitions();

-- 3. Allow internal RPCs to set payment_status (cash settlement)
CREATE OR REPLACE FUNCTION public.protect_delivery_money_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF current_setting('ridely.internal_delivery_update', true) = 'on' THEN
    -- Still forbid changing total_cost / user_id / payment_method / reference from RPCs
    IF NEW.total_cost IS DISTINCT FROM OLD.total_cost
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
    THEN
      RAISE EXCEPTION 'Cannot modify delivery payment or pricing columns'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.total_cost IS DISTINCT FROM OLD.total_cost
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
     OR NEW.amount_paid IS DISTINCT FROM OLD.amount_paid
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Cannot modify delivery payment or pricing columns'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Payment-gated earnings
CREATE OR REPLACE FUNCTION public.calculate_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status = 'delivered' OR NEW.status = 'completed')
     AND (OLD.status IS NULL OR (OLD.status <> 'delivered' AND OLD.status <> 'completed'))
     AND NEW.rider_id IS NOT NULL
     AND NEW.payment_status = 'paid'
  THEN
    INSERT INTO public.earnings (delivery_id, rider_id, gross_amount, ridely_fee, net_amount, status)
    VALUES (
      NEW.id,
      NEW.rider_id,
      NEW.total_cost,
      NEW.total_cost * 0.15,
      NEW.total_cost * 0.85,
      'completed'
    )
    ON CONFLICT (delivery_id) DO NOTHING;

    IF FOUND THEN
      PERFORM set_config('ridely.internal_rider_trust', 'on', true);

      UPDATE public.riders
      SET total_deliveries = total_deliveries + 1, updated_at = now()
      WHERE id = NEW.rider_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. accept_delivery sets bypass for status machine
CREATE OR REPLACE FUNCTION public.accept_delivery(p_delivery_id uuid)
RETURNS public.deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status rider_account_verification_status;
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

  PERFORM set_config('ridely.internal_delivery_update', 'on', true);

  UPDATE public.deliveries
  SET
    rider_id = v_uid,
    status = 'accepted',
    updated_at = now()
  WHERE id = p_delivery_id
    AND status = 'pending'
    AND rider_id IS NULL
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

-- 6. Handoff: deliver + mark cash paid
CREATE OR REPLACE FUNCTION public.verify_delivery_handoff(
  p_delivery_id uuid,
  p_code text,
  p_proof_photo_path text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider_id uuid;
  v_status delivery_status;
  v_handoff_code text;
  v_payment_method text;
BEGIN
  SELECT rider_id, status, payment_method
  INTO v_rider_id, v_status, v_payment_method
  FROM public.deliveries
  WHERE id = p_delivery_id;

  IF v_rider_id IS NULL OR v_rider_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to verify this delivery';
  END IF;

  IF v_status <> 'picked_up' THEN
    RAISE EXCEPTION 'Delivery is not in picked_up state';
  END IF;

  SELECT code INTO v_handoff_code
  FROM public.delivery_handoffs
  WHERE delivery_id = p_delivery_id AND verified = false;

  IF v_handoff_code IS NULL THEN
    RAISE EXCEPTION 'No pending handoff code for this delivery';
  END IF;

  IF trim(p_code) <> v_handoff_code THEN
    RETURN false;
  END IF;

  UPDATE public.delivery_handoffs
  SET verified = true, verified_at = now()
  WHERE delivery_id = p_delivery_id;

  PERFORM set_config('ridely.internal_delivery_update', 'on', true);

  UPDATE public.deliveries
  SET
    status = 'delivered',
    completed_at = now(),
    updated_at = now(),
    proof_photo_path = COALESCE(p_proof_photo_path, proof_photo_path),
    payment_status = CASE
      WHEN v_payment_method = 'cash' THEN 'paid'
      ELSE payment_status
    END,
    amount_paid = CASE
      WHEN v_payment_method = 'cash' THEN total_cost
      ELSE amount_paid
    END
  WHERE id = p_delivery_id;

  UPDATE public.riders
  SET is_available = true, updated_at = now()
  WHERE id = v_rider_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_delivery_handoff(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_delivery(uuid) TO authenticated;

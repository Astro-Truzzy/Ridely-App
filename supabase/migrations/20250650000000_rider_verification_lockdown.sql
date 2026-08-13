-- Lock rider verification / trust columns; require verified for accept via RPC.

-- 1. Protect rider trust columns (clients cannot self-verify)
CREATE OR REPLACE FUNCTION public.protect_rider_trust_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Internal triggers/RPCs (e.g. calculate_earnings) may bump total_deliveries
  IF current_setting('ridely.internal_rider_trust', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Never allow client to set verified or change other trust fields
  IF NEW.license_status IS DISTINCT FROM OLD.license_status
     OR NEW.insurance_status IS DISTINCT FROM OLD.insurance_status
     OR NEW.background_check IS DISTINCT FROM OLD.background_check
     OR NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.total_deliveries IS DISTINCT FROM OLD.total_deliveries
  THEN
    RAISE EXCEPTION 'Cannot modify rider trust columns'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.account_verification_status IS DISTINCT FROM OLD.account_verification_status THEN
    -- Allow rider to move not_submitted/rejected -> pending (apply flow)
    IF NEW.account_verification_status = 'pending'
       AND OLD.account_verification_status IN ('not_submitted', 'rejected')
       AND NEW.id = auth.uid()
    THEN
      NULL; -- allowed
    ELSE
      RAISE EXCEPTION 'Cannot change account_verification_status'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_protect_rider_trust_columns ON public.riders;
CREATE TRIGGER trigger_protect_rider_trust_columns
  BEFORE UPDATE ON public.riders
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_rider_trust_columns();

-- 2. Protect verification document review fields
CREATE OR REPLACE FUNCTION public.protect_rider_verification_doc_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.review_status IS DISTINCT FROM OLD.review_status
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.rider_id IS DISTINCT FROM OLD.rider_id
  THEN
    RAISE EXCEPTION 'Cannot modify verification review columns'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_protect_rider_verification_doc_columns
  ON public.rider_verification_documents;
CREATE TRIGGER trigger_protect_rider_verification_doc_columns
  BEFORE UPDATE ON public.rider_verification_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_rider_verification_doc_columns();

-- 3. accept_delivery RPC — verified riders only
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

GRANT EXECUTE ON FUNCTION public.accept_delivery(uuid) TO authenticated;

-- 4. Block direct claim bypass
DROP POLICY IF EXISTS "Riders can claim pending deliveries" ON public.deliveries;

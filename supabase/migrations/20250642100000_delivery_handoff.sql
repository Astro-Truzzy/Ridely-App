-- =============================================================================
-- Delivery handoff OTP: 4-digit code generated on delivery creation.
-- Customer can read; rider verifies via SECURITY DEFINER RPC.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.delivery_handoffs (
  delivery_id uuid PRIMARY KEY REFERENCES public.deliveries(id) ON DELETE CASCADE,
  code text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.delivery_handoffs ENABLE ROW LEVEL SECURITY;

-- Only the delivery owner (customer) can read the handoff code
DROP POLICY IF EXISTS delivery_handoffs_select_customer ON public.delivery_handoffs;
CREATE POLICY delivery_handoffs_select_customer ON public.delivery_handoffs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_handoffs.delivery_id
        AND d.user_id = auth.uid()
    )
  );

-- Generate 4-digit OTP when a delivery is created
CREATE OR REPLACE FUNCTION public.generate_delivery_handoff_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.delivery_handoffs (delivery_id, code)
  VALUES (NEW.id, lpad((floor(random() * 10000))::int::text, 4, '0'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_delivery_handoff ON public.deliveries;
CREATE TRIGGER trigger_generate_delivery_handoff
  AFTER INSERT ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.generate_delivery_handoff_code();

-- Rider verifies OTP to complete delivery
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
  v_customer_id uuid;
  v_handoff_code text;
BEGIN
  SELECT rider_id, status, user_id
  INTO v_rider_id, v_status, v_customer_id
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

  UPDATE public.deliveries
  SET
    status = 'delivered',
    completed_at = now(),
    updated_at = now(),
    proof_photo_path = COALESCE(p_proof_photo_path, proof_photo_path)
  WHERE id = p_delivery_id;

  UPDATE public.riders
  SET is_available = true, updated_at = now()
  WHERE id = v_rider_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_delivery_handoff(uuid, text, text) TO authenticated;

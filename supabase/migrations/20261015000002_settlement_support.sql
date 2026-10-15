-- =============================================================================
-- Phase 5: settlement-run support. Eligibility + atomic claim/release RPCs for
-- the twice-daily payout engine. All functions are service_role-only; the
-- scheduler calls the settlement-run edge function, never these directly.
-- =============================================================================

ALTER TABLE public.payout_batches
  ADD COLUMN IF NOT EXISTS notes text;

-- Eligible earnings for a settlement run: accrued, never claimed, on a
-- completed delivery whose customer payment is backend-verified.
CREATE OR REPLACE FUNCTION public.settlement_eligible_earnings()
RETURNS TABLE (
  earning_id uuid,
  rider_id uuid,
  net_kobo integer,
  delivery_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT e.id, e.rider_id, e.net_kobo, e.delivery_id
  FROM public.earnings e
  JOIN public.deliveries d ON d.id = e.delivery_id
  WHERE e.status IN ('pending', 'completed')
    AND e.payout_batch_id IS NULL
    AND e.reserved_at IS NULL
    AND e.net_kobo IS NOT NULL
    AND e.net_kobo > 0
    AND d.status IN ('delivered', 'completed')
    AND d.payment_status = 'paid'
    AND d.rider_id = e.rider_id;
$$;

-- Atomically claim earnings into a batch. Only rows still unclaimed are
-- updated; the returned set is exactly what this worker reserved, so
-- concurrent workers can never double-claim the same earning.
CREATE OR REPLACE FUNCTION public.claim_earnings_for_batch(
  p_batch_id uuid,
  p_earning_ids uuid[]
)
RETURNS TABLE (earning_id uuid, rider_id uuid, net_kobo integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.earnings e
  SET status = 'paid',
      payout_batch_id = p_batch_id,
      reserved_at = now(),
      updated_at = now()
  WHERE e.id = ANY (p_earning_ids)
    AND e.status IN ('pending', 'completed')
    AND e.payout_batch_id IS NULL
  RETURNING e.id, e.rider_id, e.net_kobo;
$$;

-- Release a batch's claim (transfer failed definitively): earnings return to
-- 'completed' with linkage cleared so the next run picks them up. Only rows
-- still linked to THIS batch are touched — never another batch's reservation.
CREATE OR REPLACE FUNCTION public.release_batch_earnings(
  p_batch_id uuid,
  p_earning_ids uuid[]
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.earnings
  SET status = 'completed',
      payout_batch_id = NULL,
      reserved_at = NULL,
      updated_at = now()
  WHERE id = ANY (p_earning_ids)
    AND payout_batch_id = p_batch_id
    AND status = 'paid';
$$;

REVOKE ALL ON FUNCTION public.settlement_eligible_earnings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_earnings_for_batch(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_batch_earnings(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settlement_eligible_earnings() TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_earnings_for_batch(uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_batch_earnings(uuid, uuid[]) TO service_role;

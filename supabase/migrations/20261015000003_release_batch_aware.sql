-- =============================================================================
-- Phase 5: make the legacy release_rider_earnings() batch-aware. Batch-claimed
-- earnings carry payout_batch_id + reserved_at; a release must clear both or
-- the rows are stranded (settlement_eligible_earnings only selects unlinked
-- rows). Harmless for the manual flow, whose rows have NULL linkage.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.release_rider_earnings(p_earning_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_earning_ids IS NULL OR array_length(p_earning_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.earnings
  SET status = 'completed',
      payout_batch_id = NULL,
      reserved_at = NULL,
      updated_at = now()
  WHERE id = ANY(p_earning_ids)
    AND status = 'paid';
END;
$$;

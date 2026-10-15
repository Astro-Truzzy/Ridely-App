-- =============================================================================
-- Phase 6: admin flag + rider-visible settlement batches.
-- - users.is_admin grants access to the admin-finance edge function (which
--   re-checks the flag server-side; the flag is never trusted from the client).
-- - Riders may read only the payout_batches rows linked to their own payout
--   requests (to show scheduled-run context in the wallet). No client writes.
-- =============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_admin IS 'Admin dashboard access. Enforced server-side in admin-finance; set manually via SQL.';

DROP POLICY IF EXISTS payout_batches_select_own ON public.payout_batches;
CREATE POLICY payout_batches_select_own ON public.payout_batches
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rider_payout_requests r
      WHERE r.batch_id = payout_batches.id
        AND r.rider_id = auth.uid()
    )
  );

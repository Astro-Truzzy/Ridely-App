-- =============================================================================
-- Wallet reconciliation snapshots + drift alert history.
-- Used by supabase/functions/wallet-reconciliation.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.wallet_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  liabilities_total numeric NOT NULL DEFAULT 0,
  internal_success_credit_total numeric NOT NULL DEFAULT 0,
  internal_success_debit_total numeric NOT NULL DEFAULT 0,
  internal_wallet_topup_window numeric NOT NULL DEFAULT 0,
  internal_withdrawal_window numeric NOT NULL DEFAULT 0,
  paystack_charge_window numeric NOT NULL DEFAULT 0,
  paystack_transfer_window numeric NOT NULL DEFAULT 0,
  topup_drift numeric NOT NULL DEFAULT 0,
  withdrawal_drift numeric NOT NULL DEFAULT 0,
  ledger_drift numeric NOT NULL DEFAULT 0,
  threshold numeric NOT NULL DEFAULT 0,
  exceeded_threshold boolean NOT NULL DEFAULT false,
  alert_sent boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_reconciliation_runs_created_at
  ON public.wallet_reconciliation_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_reconciliation_runs_window
  ON public.wallet_reconciliation_runs(window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_wallet_reconciliation_runs_exceeded
  ON public.wallet_reconciliation_runs(exceeded_threshold)
  WHERE exceeded_threshold = true;

ALTER TABLE public.wallet_reconciliation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_reconciliation_runs_deny_all ON public.wallet_reconciliation_runs;
CREATE POLICY wallet_reconciliation_runs_deny_all
  ON public.wallet_reconciliation_runs
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

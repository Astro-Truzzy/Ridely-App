-- =============================================================================
-- Phase 2: cashless ledger foundation (Ridely payment upgrade).
-- Adds payments + append-only ledger + payout batches + rider bank details, extends
-- earnings and rider_payout_requests with kobo integers and batch linkage, and
-- backfills history. All money going forward is integer kobo (NGN minor units).
--
-- Kobo migration rule (single, documented): kobo = ROUND(naira * 100), applied once
-- at backfill/pricing time. For existing earnings rows: gross_kobo and net_kobo are
-- rounded from the stored naira values and fee_kobo = gross_kobo - net_kobo, so the
-- identity gross = fee + net holds exactly. New accruals use integer kobo math:
-- fee_kobo = ROUND(gross_kobo * 15 / 100), net_kobo = gross_kobo - fee_kobo.
--
-- Ledger convention (documented): ledger_entries is an append-only EVENT LOG, not a
-- double-entry balance sheet. Each `type` aggregates independently:
--   collection (+gross) + rider_accrued (-net) + commission_earned (+fee) per paid
--   delivery satisfies collection = commission + rider payout by construction.
--   payout (-amount) on provider-confirmed transfer; payout_reversal (+amount) and
--   refund (-amount) on failure/reversal. Never UPDATE/DELETE rows (enforced by
--   trigger); corrections are new reversal/adjustment rows.
--
-- Rollback: additive only. Down-migration = drop new tables/columns/policies added
-- here (listed in §8). Historical naira columns are left untouched, so rollback is
-- safe while no Phase 3+ code depends on the new columns.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. payments — one row per delivery, the source of truth for customer payment.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL UNIQUE REFERENCES public.deliveries(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'paystack' CHECK (provider = 'paystack'),
  method text NOT NULL CHECK (method IN ('card', 'bank_transfer')),
  reference text NOT NULL UNIQUE,
  expected_amount_kobo integer NOT NULL CHECK (expected_amount_kobo > 0),
  confirmed_amount_kobo integer CHECK (confirmed_amount_kobo IS NULL OR confirmed_amount_kobo >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'successful', 'failed', 'expired', 'refunded', 'partially_refunded')),
  provider_transaction_id text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_delivery ON public.payments(delivery_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Customers read their own payment rows. No client INSERT/UPDATE/DELETE:
-- only service_role (edge functions) writes payments.
DROP POLICY IF EXISTS payments_select_own ON public.payments;
CREATE POLICY payments_select_own ON public.payments
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

COMMENT ON TABLE public.payments IS 'Per-delivery customer payment record. Success is set only by backend verification (edge function), never by the client.';

-- -----------------------------------------------------------------------------
-- 2. ledger_entries — append-only financial event log.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE RESTRICT,
  payout_id uuid REFERENCES public.rider_payout_requests(id) ON DELETE RESTRICT,
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  amount_kobo integer NOT NULL,
  type text NOT NULL CHECK (type IN (
    'collection', 'commission_earned', 'rider_accrued',
    'payout', 'payout_reversal', 'refund', 'adjustment'
  )),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_delivery ON public.ledger_entries(delivery_id);
CREATE INDEX IF NOT EXISTS idx_ledger_payout ON public.ledger_entries(payout_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON public.ledger_entries(type);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON public.ledger_entries(created_at DESC);

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- No client access at all (mirrors wallet_reconciliation_runs pattern).
DROP POLICY IF EXISTS ledger_entries_deny_all ON public.ledger_entries;
CREATE POLICY ledger_entries_deny_all ON public.ledger_entries
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- Append-only: forbid UPDATE/DELETE for every role (corrections are new rows).
CREATE OR REPLACE FUNCTION public.forbid_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only; post a reversal/adjustment row instead'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trigger_ledger_no_update ON public.ledger_entries;
CREATE TRIGGER trigger_ledger_no_update
  BEFORE UPDATE OR DELETE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.forbid_ledger_mutation();

COMMENT ON TABLE public.ledger_entries IS 'Append-only financial event log in integer kobo. See migration header for the signed-amount convention.';

-- -----------------------------------------------------------------------------
-- 3. payout_batches — twice-daily settlement runs (00:00 + 18:00 Africa/Lagos).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payout_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot text NOT NULL CHECK (slot IN ('00:00', '18:00')),
  lagos_business_date date NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'processing', 'completed', 'partial', 'failed')),
  eligible_rider_count integer NOT NULL DEFAULT 0,
  total_amount_kobo integer NOT NULL DEFAULT 0,
  paid_amount_kobo integer NOT NULL DEFAULT 0,
  failed_amount_kobo integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_batches_slot_day
  ON public.payout_batches (lagos_business_date, slot);
CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON public.payout_batches(status);

ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;

-- Service-role only for now; Phase 6 adds an admin read policy.
DROP POLICY IF EXISTS payout_batches_deny_all ON public.payout_batches;
CREATE POLICY payout_batches_deny_all ON public.payout_batches
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

COMMENT ON TABLE public.payout_batches IS 'Settlement runs are initiation cutoffs (pg_cron 23:00/17:00 UTC = 00:00/18:00 WAT), not guaranteed bank-credit times.';

-- -----------------------------------------------------------------------------
-- 4. rider_banks — verified payout destinations (one row per rider+account).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rider_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  account_number text NOT NULL CHECK (account_number ~ '^\d{10}$'),
  bank_code text NOT NULL,
  account_name text,
  recipient_code text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rider_id, account_number, bank_code)
);

CREATE INDEX IF NOT EXISTS idx_rider_banks_rider ON public.rider_banks(rider_id);

ALTER TABLE public.rider_banks ENABLE ROW LEVEL SECURITY;

-- Riders read their own destinations; writes are service-role only until the
-- Phase 6 secure bank-settings flow (which validates via Paystack server-side).
DROP POLICY IF EXISTS rider_banks_select_own ON public.rider_banks;
CREATE POLICY rider_banks_select_own ON public.rider_banks
  FOR SELECT TO authenticated
  USING (rider_id = auth.uid());

COMMENT ON TABLE public.rider_banks IS 'Payout destinations. Never pay to a row with verified_at IS NULL.';

-- -----------------------------------------------------------------------------
-- 5. Extend earnings (kobo columns + batch linkage) and rider_payout_requests.
-- -----------------------------------------------------------------------------
ALTER TABLE public.earnings
  ADD COLUMN IF NOT EXISTS gross_kobo integer CHECK (gross_kobo IS NULL OR gross_kobo >= 0),
  ADD COLUMN IF NOT EXISTS fee_kobo integer CHECK (fee_kobo IS NULL OR fee_kobo >= 0),
  ADD COLUMN IF NOT EXISTS net_kobo integer CHECK (net_kobo IS NULL OR net_kobo >= 0),
  ADD COLUMN IF NOT EXISTS payout_batch_id uuid REFERENCES public.payout_batches(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS reserved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_earnings_batch ON public.earnings(payout_batch_id);
CREATE INDEX IF NOT EXISTS idx_earnings_rider_status ON public.earnings(rider_id, status);

ALTER TABLE public.rider_payout_requests
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.payout_batches(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS amount_kobo integer CHECK (amount_kobo IS NULL OR amount_kobo > 0);

CREATE INDEX IF NOT EXISTS idx_rider_payout_requests_batch ON public.rider_payout_requests(batch_id);

-- deliveries: allow the new bank_transfer method (enforced off for new bookings
-- until Phase 3 ships; the check constraint must accept it before any transfer
-- delivery row can exist).
DO $$
BEGIN
  ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_payment_method_check;
  ALTER TABLE public.deliveries
    ADD CONSTRAINT deliveries_payment_method_check
    CHECK (payment_method IN ('cash', 'card', 'wallet', 'bank_transfer'));
END $$;

COMMENT ON COLUMN public.deliveries.payment_method IS 'cash | card | wallet | bank_transfer (cash disabled for new bookings in Phase 4; history preserved)';

-- -----------------------------------------------------------------------------
-- 6. Backfill history (one-time; see kobo rule in header).
-- -----------------------------------------------------------------------------
-- 6a. payments from backend-verified paid deliveries.
INSERT INTO public.payments
  (delivery_id, customer_id, provider, method, reference,
   expected_amount_kobo, confirmed_amount_kobo, status, confirmed_at, updated_at)
SELECT
  d.id, d.user_id, 'paystack', d.payment_method, d.payment_reference,
  ROUND(COALESCE(d.amount_paid, d.total_cost) * 100)::integer,
  ROUND(COALESCE(d.amount_paid, d.total_cost) * 100)::integer,
  'successful', d.updated_at, now()
FROM public.deliveries d
WHERE d.payment_status = 'paid'
  AND d.payment_reference IS NOT NULL
  AND d.payment_method IN ('card', 'bank_transfer')
ON CONFLICT (reference) DO NOTHING;

-- 6b. earnings kobo columns.
UPDATE public.earnings
SET gross_kobo = ROUND(gross_amount * 100)::integer,
    net_kobo = ROUND(net_amount * 100)::integer,
    fee_kobo = ROUND(gross_amount * 100)::integer - ROUND(net_amount * 100)::integer,
    updated_at = now()
WHERE gross_kobo IS NULL;

-- 6c. rider_payout_requests amount_kobo.
UPDATE public.rider_payout_requests
SET amount_kobo = ROUND(amount * 100)::integer,
    updated_at = now()
WHERE amount_kobo IS NULL;

-- 6d. rider_banks: latest successful payout destination per rider, UNVERIFIED —
-- re-verify via Paystack before the first scheduled run (Phase 5).
INSERT INTO public.rider_banks (rider_id, account_number, bank_code, account_name, recipient_code)
SELECT DISTINCT ON (r.rider_id)
  r.rider_id, r.account_number, r.bank_code, r.account_name, r.recipient_code
FROM public.rider_payout_requests r
WHERE r.status = 'transfer_success'
  AND r.account_number ~ '^\d{10}$'
  AND r.bank_code IS NOT NULL AND r.bank_code <> ''
ORDER BY r.rider_id, r.updated_at DESC
ON CONFLICT (rider_id, account_number, bank_code) DO NOTHING;

-- 6e. ledger backfill: collections, accruals, commission, confirmed payouts.
INSERT INTO public.ledger_entries (delivery_id, amount_kobo, type, note)
SELECT d.id, ROUND(COALESCE(d.amount_paid, d.total_cost) * 100)::integer,
       'collection', 'backfill: verified customer payment'
FROM public.deliveries d
WHERE d.payment_status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM public.ledger_entries l
    WHERE l.delivery_id = d.id AND l.type = 'collection'
  );

INSERT INTO public.ledger_entries (delivery_id, amount_kobo, type, note)
SELECT e.delivery_id, -e.net_kobo, 'rider_accrued', 'backfill: rider earning obligation'
FROM public.earnings e
WHERE e.net_kobo IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.ledger_entries l
    WHERE l.delivery_id = e.delivery_id AND l.type = 'rider_accrued'
  );

INSERT INTO public.ledger_entries (delivery_id, amount_kobo, type, note)
SELECT e.delivery_id, e.fee_kobo, 'commission_earned', 'backfill: 15% Ridely commission'
FROM public.earnings e
WHERE e.fee_kobo IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.ledger_entries l
    WHERE l.delivery_id = e.delivery_id AND l.type = 'commission_earned'
  );

INSERT INTO public.ledger_entries (payout_id, amount_kobo, type, note)
SELECT r.id, -r.amount_kobo, 'payout', 'backfill: provider-confirmed rider transfer'
FROM public.rider_payout_requests r
WHERE r.status = 'transfer_success'
  AND r.amount_kobo IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.ledger_entries l
    WHERE l.payout_id = r.id AND l.type = 'payout'
  );

-- -----------------------------------------------------------------------------
-- 7. Accrual trigger: kobo math + automatic ledger rows (exactly-once).
--    Keeps the paid-gate and per-delivery uniqueness from the earnings-gate
--    migration; adds integer kobo columns and ledger writes.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gross_kobo integer;
  v_fee_kobo integer;
  v_net_kobo integer;
  v_earning_id uuid;
BEGIN
  IF (NEW.status = 'delivered' OR NEW.status = 'completed')
     AND (OLD.status IS NULL OR (OLD.status <> 'delivered' AND OLD.status <> 'completed'))
     AND NEW.rider_id IS NOT NULL
     AND NEW.payment_status = 'paid'
  THEN
    -- Integer kobo math: single rounding at the pricing stage.
    v_gross_kobo := ROUND(NEW.total_cost * 100)::integer;
    v_fee_kobo := ROUND(v_gross_kobo * 15.0 / 100.0)::integer;
    v_net_kobo := v_gross_kobo - v_fee_kobo;

    INSERT INTO public.earnings
      (delivery_id, rider_id, gross_amount, ridely_fee, net_amount, status,
       gross_kobo, fee_kobo, net_kobo)
    VALUES (
      NEW.id,
      NEW.rider_id,
      NEW.total_cost,
      NEW.total_cost * 0.15,
      NEW.total_cost * 0.85,
      'completed',
      v_gross_kobo, v_fee_kobo, v_net_kobo
    )
    ON CONFLICT (delivery_id) DO NOTHING
    RETURNING id INTO v_earning_id;

    IF v_earning_id IS NOT NULL THEN
      -- Ledger rows, guarded so concurrent/duplicate trigger fires stay idempotent.
      INSERT INTO public.ledger_entries (delivery_id, amount_kobo, type, note)
      SELECT NEW.id, -v_net_kobo, 'rider_accrued', 'rider earning obligation'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.ledger_entries
        WHERE delivery_id = NEW.id AND type = 'rider_accrued'
      );

      INSERT INTO public.ledger_entries (delivery_id, amount_kobo, type, note)
      SELECT NEW.id, v_fee_kobo, 'commission_earned', '15% Ridely commission'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.ledger_entries
        WHERE delivery_id = NEW.id AND type = 'commission_earned'
      );

      PERFORM set_config('ridely.internal_rider_trust', 'on', true);

      UPDATE public.riders
      SET total_deliveries = total_deliveries + 1, updated_at = now()
      WHERE id = NEW.rider_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. Rollback (down-migration sketch — run manually, never automatically):
--    DROP TRIGGER trigger_ledger_no_update ON public.ledger_entries;
--    DROP FUNCTION public.forbid_ledger_mutation();
--    DROP TABLE public.ledger_entries, public.payments,
--               public.payout_batches, public.rider_banks;
--    ALTER TABLE public.earnings DROP COLUMN gross_kobo, DROP COLUMN fee_kobo,
--      DROP COLUMN net_kobo, DROP COLUMN payout_batch_id, DROP COLUMN reserved_at;
--    ALTER TABLE public.rider_payout_requests DROP COLUMN batch_id,
--      DROP COLUMN amount_kobo;
--    (Restore the prior calculate_earnings() from
--     20250651000000_delivery_status_and_earnings_gate.sql if rolling back.)
-- =============================================================================

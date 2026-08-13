-- Payment enforcement on deliveries: columns, drop client INSERT, lock money columns on UPDATE.

-- 1. Payment columns
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS amount_paid numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deliveries_payment_method_check'
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT deliveries_payment_method_check
      CHECK (payment_method IN ('cash', 'card', 'wallet'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deliveries_payment_status_check'
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT deliveries_payment_status_check
      CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'refunded'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deliveries_card_paid_requires_reference'
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT deliveries_card_paid_requires_reference
      CHECK (
        NOT (payment_method = 'card' AND payment_status = 'paid')
        OR payment_reference IS NOT NULL
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_payment_reference
  ON public.deliveries (payment_reference)
  WHERE payment_reference IS NOT NULL;

-- 2. Only service role (edge functions) may insert deliveries
DROP POLICY IF EXISTS "Users can insert own deliveries" ON public.deliveries;

-- 3. Prevent clients from changing money / ownership columns
CREATE OR REPLACE FUNCTION public.protect_delivery_money_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypasses; authenticated clients cannot mutate money fields
  IF coalesce(auth.role(), '') = 'service_role' THEN
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

DROP TRIGGER IF EXISTS trigger_protect_delivery_money_columns ON public.deliveries;
CREATE TRIGGER trigger_protect_delivery_money_columns
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_delivery_money_columns();

COMMENT ON COLUMN public.deliveries.payment_method IS 'cash | card | wallet';
COMMENT ON COLUMN public.deliveries.payment_status IS 'unpaid | pending | paid | failed | refunded';
COMMENT ON COLUMN public.deliveries.payment_reference IS 'Paystack (or other) charge reference; unique when set';
COMMENT ON COLUMN public.deliveries.amount_paid IS 'Amount confirmed paid (naira), for card/wallet';

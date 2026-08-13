-- =============================================================================
-- Strengthen transactions model for reporting/debugging.
-- Adds category/provider/provider_reference/metadata and backfills legacy rows.
-- =============================================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_reference text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Reasonable controlled vocabulary, while allowing future extension by migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transactions_category_check'
      AND conrelid = 'public.transactions'::regclass
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_category_check
      CHECK (
        category IS NULL OR category IN (
          'wallet_topup',
          'wallet_withdrawal',
          'promo_credit',
          'booking_charge',
          'card_authorization',
          'other'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_provider_reference ON public.transactions(provider, provider_reference);

-- Backfill existing rows by legacy reference patterns.
UPDATE public.transactions
SET category = CASE
  WHEN reference LIKE 'promo:%' THEN 'promo_credit'
  WHEN reference LIKE 'wd_%' THEN 'wallet_withdrawal'
  WHEN type = 'credit' THEN 'wallet_topup'
  WHEN type = 'debit' THEN 'booking_charge'
  ELSE 'other'
END
WHERE category IS NULL;

UPDATE public.transactions
SET provider = CASE
  WHEN reference LIKE 'promo:%' THEN 'internal'
  ELSE 'paystack'
END
WHERE provider IS NULL;

UPDATE public.transactions
SET provider_reference = reference
WHERE provider_reference IS NULL;

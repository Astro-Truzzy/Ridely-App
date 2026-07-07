-- =============================================================================
-- Paystack wallet, saved cards, and transactions (per PAYSTACK_IMPLEMENTATION_SPEC).
-- Used for wallet funding, Add Card, and charge_authorization.
-- =============================================================================

-- users_wallet: one row per user, balance in Naira
CREATE TABLE IF NOT EXISTS public.users_wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_wallet_user_id ON public.users_wallet(user_id);

ALTER TABLE public.users_wallet ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_wallet_select_own
  ON public.users_wallet FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY users_wallet_update_own
  ON public.users_wallet FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY users_wallet_insert_own
  ON public.users_wallet FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- saved_cards: Paystack authorization_code and card metadata for charging later
CREATE TABLE IF NOT EXISTS public.saved_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  authorization_code text NOT NULL,
  last4 text,
  exp_month text,
  exp_year text,
  brand text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, authorization_code)
);

CREATE INDEX IF NOT EXISTS idx_saved_cards_user_id ON public.saved_cards(user_id);

ALTER TABLE public.saved_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_cards_select_own
  ON public.saved_cards FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY saved_cards_insert_own
  ON public.saved_cards FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_cards_update_own
  ON public.saved_cards FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_cards_delete_own
  ON public.saved_cards FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- transactions: audit log; reference is unique for idempotency (webhook)
-- amount stored in Naira (Paystack sends kobo; divide by 100 when recording)
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  reference text NOT NULL UNIQUE,
  status text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_reference ON public.transactions(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY transactions_select_own
  ON public.transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Inserts from webhook use service_role (RLS bypassed); no INSERT policy for authenticated needed for webhook.

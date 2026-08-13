-- =============================================================================
-- Wallet withdrawals: withdrawal_requests audit table + atomic debit RPC.
-- Payout is executed via Paystack Transfers inside the wallet-withdraw Edge
-- Function (service role). Clients never write the wallet balance directly.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  bank_code text NOT NULL,
  account_number text NOT NULL,
  account_name text,
  recipient_code text,
  transfer_code text,
  reference text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  failure_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_reference ON public.withdrawal_requests(reference);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own withdrawal requests; inserts happen via service role.
DROP POLICY IF EXISTS withdrawal_requests_select_own ON public.withdrawal_requests;
CREATE POLICY withdrawal_requests_select_own ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Atomic debit: decrement balance only if sufficient funds. Returns true on success.
-- SECURITY DEFINER so it can update users_wallet (client write policies are locked).
-- Guarded so it can only ever debit the caller's own wallet.
CREATE OR REPLACE FUNCTION public.debit_wallet(p_user_id uuid, p_amount numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  UPDATE public.users_wallet
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE user_id = p_user_id
    AND balance >= p_amount;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Credit back (used to refund a failed transfer). SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.credit_wallet(p_user_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  UPDATE public.users_wallet
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.users_wallet (user_id, balance) VALUES (p_user_id, p_amount);
  END IF;
END;
$$;

-- Only the service role should call these directly; revoke from anon/authenticated.
REVOKE ALL ON FUNCTION public.debit_wallet(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_wallet(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debit_wallet(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric) TO service_role;

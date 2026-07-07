-- =============================================================================
-- Payment methods: store card/wallet metadata for customers (no full card numbers).
-- Use with Stripe, Paystack, or another gateway; store only last4, brand, expiry.
-- =============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type') THEN
    CREATE TYPE payment_method_type AS ENUM ('card', 'wallet', 'cash', 'bank');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type payment_method_type NOT NULL DEFAULT 'card',
  label text NOT NULL,
  last_four text,
  brand text,
  expiry_month integer,
  expiry_year integer,
  gateway_payment_method_id text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Only one default per user (enforced by partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_user_default
  ON public.payment_methods (user_id)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON public.payment_methods(user_id);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_methods_select_own
  ON public.payment_methods FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY payment_methods_insert_own
  ON public.payment_methods FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY payment_methods_update_own
  ON public.payment_methods FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY payment_methods_delete_own
  ON public.payment_methods FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Trigger to clear other defaults when setting one as default
CREATE OR REPLACE FUNCTION public.payment_methods_clear_other_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.payment_methods
    SET is_default = false, updated_at = now()
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS payment_methods_before_update ON public.payment_methods;
CREATE TRIGGER payment_methods_before_update
  BEFORE INSERT OR UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.payment_methods_clear_other_defaults();

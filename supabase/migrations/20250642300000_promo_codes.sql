-- =============================================================================
-- Promo codes: wallet credit on redemption via Edge Function (service role).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  credit_amount numeric NOT NULL CHECK (credit_amount > 0),
  max_redemptions integer,
  per_user_limit integer NOT NULL DEFAULT 1 CHECK (per_user_limit > 0),
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON public.promo_codes(active) WHERE active = true;

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (promo_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON public.promo_redemptions(user_id);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

-- No client SELECT on promo_codes — redemption goes through the redeem-promo
-- edge function (service role). Listing active codes would leak unlisted promos.
DROP POLICY IF EXISTS promo_codes_select_active ON public.promo_codes;
DROP POLICY IF EXISTS promo_codes_deny_all ON public.promo_codes;
CREATE POLICY promo_codes_deny_all
  ON public.promo_codes
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS promo_redemptions_select_own ON public.promo_redemptions;
CREATE POLICY promo_redemptions_select_own ON public.promo_redemptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Seed a welcome promo for testing (optional)
INSERT INTO public.promo_codes (code, credit_amount, max_redemptions, per_user_limit, expires_at, active)
VALUES ('RIDELY500', 500, 1000, 1, now() + interval '1 year', true)
ON CONFLICT (code) DO NOTHING;

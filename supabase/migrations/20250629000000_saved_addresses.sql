-- =============================================================================
-- Saved addresses: user-defined labels (Home, Work, etc.) with address + coords.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.saved_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  address text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_addresses_user_id ON public.saved_addresses(user_id);

ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_addresses_select_own
  ON public.saved_addresses FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY saved_addresses_insert_own
  ON public.saved_addresses FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_addresses_update_own
  ON public.saved_addresses FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_addresses_delete_own
  ON public.saved_addresses FOR DELETE TO authenticated
  USING (user_id = auth.uid());

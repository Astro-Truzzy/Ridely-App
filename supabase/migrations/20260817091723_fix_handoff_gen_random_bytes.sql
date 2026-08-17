-- pgcrypto lives in the `extensions` schema on hosted Supabase.
-- generate_delivery_handoff_code used search_path = public only, so
-- gen_random_bytes() failed and every new booking insert aborted.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.generate_delivery_handoff_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.delivery_handoffs (delivery_id, code)
  VALUES (
    NEW.id,
    lpad((('x' || encode(gen_random_bytes(2), 'hex'))::bit(16)::int % 10000)::text, 4, '0')
  );
  RETURN NEW;
END;
$$;

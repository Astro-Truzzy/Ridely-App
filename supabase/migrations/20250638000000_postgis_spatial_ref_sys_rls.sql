-- =============================================================================
-- Security: RLS on PostGIS spatial_ref_sys (Supabase Security Advisor)
--
-- PostGIS creates public.spatial_ref_sys when installed in the public schema.
-- The Ridely app never reads this catalog via PostgREST — only ST_* functions
-- use it internally. Enable RLS (no policies) and revoke API role access.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'spatial_ref_sys'
      AND c.relkind = 'r'
  ) THEN
    EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';
    REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon, authenticated;
  END IF;
END $$;

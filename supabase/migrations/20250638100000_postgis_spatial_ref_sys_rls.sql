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
    BEGIN
      EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';
      REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon, authenticated;
    EXCEPTION WHEN insufficient_privilege THEN
      -- Already handled by the table owner in an earlier deploy; the migration
      -- role can't own PostGIS catalogs, so skip instead of failing the push.
      RAISE NOTICE 'Skipping spatial_ref_sys RLS: insufficient privilege';
    END;
  END IF;
END $$;

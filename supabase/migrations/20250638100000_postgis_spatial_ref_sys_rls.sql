-- =============================================================================
-- Security: RLS on PostGIS spatial_ref_sys (Supabase Security Advisor)
--
-- PostGIS creates public.spatial_ref_sys when installed in the public schema.
-- It is a static, world-readable catalog of coordinate systems (no user or
-- app data), but the advisor requires RLS on every table exposed to PostgREST.
-- Keep it world-readable via a permissive SELECT policy. Do NOT revoke access
-- with no policies: PostGIS functions (ST_Transform, ST_DWithin, ...) read
-- this catalog as the caller, so deny-all breaks spatial queries for non-owners.
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
      EXECUTE 'GRANT SELECT ON public.spatial_ref_sys TO anon, authenticated';
      EXECUTE 'DROP POLICY IF EXISTS "Public read spatial_ref_sys" ON public.spatial_ref_sys';
      EXECUTE 'CREATE POLICY "Public read spatial_ref_sys" ON public.spatial_ref_sys FOR SELECT TO anon, authenticated USING (true)';
    EXCEPTION WHEN insufficient_privilege THEN
      -- The table is owned by the extension owner, so the migration role may
      -- not be able to ALTER it. Run the statements above manually once in the
      -- Dashboard SQL editor (as postgres); this skips instead of failing push.
      RAISE NOTICE 'Skipping spatial_ref_sys RLS: insufficient privilege (apply manually in Dashboard SQL editor)';
    END;
  END IF;
END $$;

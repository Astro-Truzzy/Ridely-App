-- =============================================================================
-- Fix: PostGIS spatial_ref_sys — permissive SELECT policy (Supabase Advisor)
--
-- Supersedes 20250638100000, which (a) used deny-all (REVOKE + no policies,
-- breaking ST_Transform/ST_DWithin for non-owners) and (b) was usually skipped
-- with "insufficient privilege" because the table is owned by the extension
-- owner, so editing that file alone never re-runs on existing databases.
--
-- This migration re-grants SELECT (undoing the old REVOKE where it applied)
-- and installs a world-readable SELECT policy: RLS enabled (advisor clears)
-- while PostGIS keeps working as intended.
--
-- NOTE: if this still logs "insufficient privilege" on `db push`, run the
-- four statements in the inner block manually once in Dashboard > SQL Editor
-- (as postgres), then re-run the Security Advisor.
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
      RAISE NOTICE 'Skipping spatial_ref_sys RLS policy: insufficient privilege (apply manually in Dashboard SQL editor)';
    END;
  END IF;
END $$;

-- =============================================================================
-- Enable realtime replication for deliveries and notifications so the app can
-- receive INSERT/UPDATE/DELETE events and patch rows in place (no polling).
-- REPLICA IDENTITY FULL ensures UPDATE/DELETE payloads carry the columns used
-- in row-level filters (user_id / rider_id), so filtered subscriptions and
-- deletes are delivered to the right clients.
-- Run after 20250640000000_rls_lockdown_financial.sql
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'deliveries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

ALTER TABLE public.deliveries REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

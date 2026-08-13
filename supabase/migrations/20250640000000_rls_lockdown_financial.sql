-- =============================================================================
-- Security hardening: close client-writable financial / spam holes.
--   1. users_wallet  – remove client INSERT/UPDATE (balance was client-settable)
--   2. earnings      – remove client INSERT (rows now created only by trigger)
--   3. notifications – tie user-inserted job requests to a delivery they own
-- Run after 20250639000000_delivery_rejections.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. users_wallet: balance must only change via the Paystack webhook
--    (service role bypasses RLS). Clients keep SELECT only.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS users_wallet_update_own ON public.users_wallet;
DROP POLICY IF EXISTS users_wallet_insert_own ON public.users_wallet;

-- -----------------------------------------------------------------------------
-- 2. earnings: rows are created by the calculate_earnings trigger only.
--    Make the trigger SECURITY DEFINER so it can insert without a client
--    INSERT policy, then drop the client INSERT policy.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status = 'delivered' OR NEW.status = 'completed')
     AND (OLD.status IS NULL OR (OLD.status <> 'delivered' AND OLD.status <> 'completed'))
     AND NEW.rider_id IS NOT NULL THEN
    INSERT INTO public.earnings (delivery_id, rider_id, gross_amount, ridely_fee, net_amount, status)
    VALUES (
      NEW.id,
      NEW.rider_id,
      NEW.total_cost,
      NEW.total_cost * 0.15,
      NEW.total_cost * 0.85,
      'completed'
    );
    UPDATE public.riders
    SET total_deliveries = total_deliveries + 1, updated_at = now()
    WHERE id = NEW.rider_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Riders can insert own earnings" ON public.earnings;

-- -----------------------------------------------------------------------------
-- 3. notifications: a customer may only notify a rider in the context of a
--    delivery they actually own (prevents spamming arbitrary riders).
--    The booking flow already sets delivery_id on job_request notifications.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert notifications for riders" ON public.notifications;
CREATE POLICY "Users can insert notifications for riders" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND rider_id IS NOT NULL
    AND delivery_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = notifications.delivery_id
        AND d.user_id = auth.uid()
    )
  );

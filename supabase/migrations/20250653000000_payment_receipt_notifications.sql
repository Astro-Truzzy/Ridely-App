-- Payment receipts: notify the rider in-app when a delivery earning is credited.
-- Extends calculate_earnings (20250651000000) to insert a 'payment' notification
-- alongside the earning. Customer/card/withdrawal/payout receipts are handled by
-- the paystack-webhook edge function.

CREATE OR REPLACE FUNCTION public.calculate_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status = 'delivered' OR NEW.status = 'completed')
     AND (OLD.status IS NULL OR (OLD.status <> 'delivered' AND OLD.status <> 'completed'))
     AND NEW.rider_id IS NOT NULL
     AND NEW.payment_status = 'paid'
  THEN
    INSERT INTO public.earnings (delivery_id, rider_id, gross_amount, ridely_fee, net_amount, status)
    VALUES (
      NEW.id,
      NEW.rider_id,
      NEW.total_cost,
      NEW.total_cost * 0.15,
      NEW.total_cost * 0.85,
      'completed'
    )
    ON CONFLICT (delivery_id) DO NOTHING;

    IF FOUND THEN
      PERFORM set_config('ridely.internal_rider_trust', 'on', true);

      UPDATE public.riders
      SET total_deliveries = total_deliveries + 1, updated_at = now()
      WHERE id = NEW.rider_id;

      -- Receipt for the rider: appears in the rider notifications inbox
      -- (rider inbox filters on rider_id = auth.uid()).
      BEGIN
        INSERT INTO public.notifications (user_id, rider_id, type, title, message, read, actionable, delivery_id)
        VALUES (
          NEW.user_id,
          NEW.rider_id,
          'payment',
          'You''ve been paid',
          'You earned ' || chr(8358) || to_char(NEW.total_cost * 0.85, 'FM999,999,990.00')
            || ' for this delivery. It has been added to your available earnings.',
          false,
          false,
          NEW.id
        );
      EXCEPTION WHEN OTHERS THEN
        -- Never block delivery completion on a notification failure.
        RAISE WARNING 'calculate_earnings: rider payment notification failed: %', SQLERRM;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

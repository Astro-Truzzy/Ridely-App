import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const AUTO_CANCEL_AFTER_MS = 2 * 60 * 1000; // 2 minutes

/** Call the Edge Function that cancels pending deliveries older than 2 minutes. */
async function invokeAutoCancel(deliveryId: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('auto-cancel-pending-deliveries', {
      body: { delivery_id: deliveryId },
    });
    if (error) {
      console.warn('auto-cancel-pending-deliveries failed', error.message);
    }
  } catch (e) {
    console.warn('auto-cancel-pending-deliveries error', e);
  }
}

export interface PendingDelivery {
  id: string;
  status: string;
  rider_id: string | null;
  created_at: string;
}

/**
 * When the given delivery is pending with no rider, schedules a one-time call to the
 * auto-cancel Edge Function so that after 2 minutes the delivery is cancelled and the
 * user gets a notification. Works even if no external cron is set up.
 */
export function useAutoCancelPendingDelivery(delivery: PendingDelivery | null | undefined): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invokedRef = useRef(false);

  useEffect(() => {
    if (!delivery || delivery.status !== 'pending' || delivery.rider_id) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      invokedRef.current = false;
      return;
    }

    const createdAt = new Date(delivery.created_at).getTime();
    const deadline = createdAt + AUTO_CANCEL_AFTER_MS;
    const now = Date.now();
    const remaining = Math.max(0, deadline - now);

    if (remaining === 0) {
      if (!invokedRef.current) {
        invokedRef.current = true;
        invokeAutoCancel(delivery.id);
      }
      return;
    }

    invokedRef.current = false;
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      invokedRef.current = true;
      invokeAutoCancel(delivery.id);
    }, remaining);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [delivery?.id, delivery?.status, delivery?.rider_id, delivery?.created_at]);
}

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const AUTO_CANCEL_AFTER_MS = 5 * 60 * 1000; // 5 minutes
const invokedDeliveryIds = new Set<string>();

async function functionErrorDetail(error: { message: string; context?: Response }): Promise<string> {
  const context = error.context;
  if (context) {
    try {
      const body = await context.clone().json();
      if (body && typeof body === 'object' && 'error' in body && body.error) {
        return `${error.message}: ${String(body.error)}`;
      }
    } catch {
      try {
        const text = await context.clone().text();
        if (text) return `${error.message}: ${text.slice(0, 200)}`;
      } catch {
        // ignore
      }
    }
  }
  return error.message;
}

/** Call the Edge Function that cancels paid-but-unclaimed deliveries older than 5 minutes. */
async function invokeAutoCancel(deliveryId: string): Promise<void> {
  if (invokedDeliveryIds.has(deliveryId)) return;
  invokedDeliveryIds.add(deliveryId);
  try {
    const { error } = await supabase.functions.invoke('auto-cancel-pending-deliveries', {
      body: { delivery_id: deliveryId },
    });
    if (error) {
      invokedDeliveryIds.delete(deliveryId);
      console.warn('auto-cancel-pending-deliveries failed', await functionErrorDetail(error));
    }
  } catch (e) {
    invokedDeliveryIds.delete(deliveryId);
    console.warn('auto-cancel-pending-deliveries error', e);
  }
}

export interface PendingDelivery {
  id: string;
  status: string;
  rider_id: string | null;
  payment_status?: string | null;
  created_at: string;
}

/**
 * When the given delivery is paid, pending, and riderless, schedules a one-time
 * call to the auto-cancel Edge Function so that after 5 minutes the delivery
 * is cancelled and the user gets a notification. Works even if no external
 * cron is set up. Unpaid bookings (e.g. bank-transfer pending) never arm this
 * timer — rider search hasn't started for them, and their expiry is owned by
 * the server's 30-minute transfer grace window.
 */
export function useAutoCancelPendingDelivery(delivery: PendingDelivery | null | undefined): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Rider search starts only after backend-verified payment: unpaid bookings
    // (e.g. bank-transfer pending) must never be auto-cancelled as "no rider".
    if (
      !delivery ||
      delivery.status !== 'pending' ||
      delivery.rider_id ||
      delivery.payment_status !== 'paid'
    ) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    const createdAt = new Date(delivery.created_at).getTime();
    const deadline = createdAt + AUTO_CANCEL_AFTER_MS;
    const now = Date.now();
    const remaining = Math.max(0, deadline - now);

    if (remaining === 0) {
      invokeAutoCancel(delivery.id);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      invokeAutoCancel(delivery.id);
    }, remaining);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [delivery?.id, delivery?.status, delivery?.rider_id, delivery?.payment_status, delivery?.created_at]);
}

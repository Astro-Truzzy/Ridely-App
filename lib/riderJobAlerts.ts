import { supabase } from '@/lib/supabase';

/**
 * Shared guards for rider job-request popups.
 *
 * A job alert is only actionable when the delivery is still open
 * (pending + unassigned + backend-verified paid) AND this rider hasn't already
 * dismissed it. Every trigger path (realtime, push tap, stale push on launch)
 * must check this before showing the DeliveryRequestModal, and every dismiss
 * path must mark the matching notifications as read so nothing re-fires.
 */

/** Returns true when the rider can still act on this delivery. Fail-open on network errors (the modal revalidates while open). */
export async function isJobActionableForRider(
  deliveryId: string,
  riderId: string
): Promise<boolean> {
  try {
    const [{ data: delivery, error: deliveryError }, { data: rejection }] =
      await Promise.all([
        (supabase as any)
          .from('deliveries')
          .select('id,status,rider_id,payment_status')
          .eq('id', deliveryId)
          .maybeSingle(),
        (supabase as any)
          .from('delivery_rejections')
          .select('delivery_id')
          .eq('rider_id', riderId)
          .eq('delivery_id', deliveryId)
          .maybeSingle(),
      ]);
    if (deliveryError) return true;
    if (rejection) return false;
    if (!delivery) return false;
    return (
      delivery.status === 'pending' &&
      delivery.rider_id == null &&
      delivery.payment_status === 'paid'
    );
  } catch {
    return true;
  }
}

/** Marks this rider's job_request notifications for a delivery as read so they stop re-triggering popups/badges. */
export async function markJobRequestNotificationsRead(
  riderId: string,
  deliveryId: string
): Promise<void> {
  try {
    await (supabase as any)
      .from('notifications')
      .update({ read: true })
      .eq('rider_id', riderId)
      .eq('delivery_id', deliveryId)
      .eq('type', 'job_request')
      .eq('read', false);
  } catch {
    // Best effort — a missed update just leaves the badge count stale.
  }
}

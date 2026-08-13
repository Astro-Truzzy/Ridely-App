import { supabase } from '@/lib/supabase';

/**
 * Records that a rider has rejected a delivery. The delivery stays available to
 * other riders but is hidden from this rider across devices.
 */
export async function rejectDelivery(riderId: string, deliveryId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('delivery_rejections')
    .upsert(
      { rider_id: riderId, delivery_id: deliveryId },
      { onConflict: 'delivery_id,rider_id', ignoreDuplicates: true }
    );
  if (error) throw error;
}

/** Returns the delivery IDs the given rider has rejected. */
export async function fetchRejectedDeliveryIds(riderId: string): Promise<string[]> {
  const { data, error } = await (supabase as any)
    .from('delivery_rejections')
    .select('delivery_id')
    .eq('rider_id', riderId);
  if (error) throw error;
  return (data ?? []).map((row: { delivery_id: string }) => row.delivery_id);
}

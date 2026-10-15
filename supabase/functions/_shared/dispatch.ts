// Shared rider-dispatch notification used by create-delivery (card bookings)
// and paystack-webhook (verified bank-transfer settlement). One implementation so
// both payment methods fan out to nearby riders exactly once.

/** Minimal admin-client surface (service-role Supabase client). */
export interface DispatchAdminClient {
  // deno-lint-ignore no-explicit-any
  rpc: any;
  // deno-lint-ignore no-explicit-any
  from: any;
}

export interface DispatchJob {
  admin: DispatchAdminClient;
  supabaseUrl: string;
  serviceRoleKey: string;
  deliveryId: string;
  customerId: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
}

/**
 * Notify nearby riders about a newly payable delivery. Best-effort: never throws —
 * dispatch notification failure must not break payment settlement.
 */
export async function notifyRidersForDelivery(job: DispatchJob): Promise<void> {
  try {
    const { data: nearbyRiders } = await job.admin.rpc('find_nearby_riders', {
      pickup_lat: job.pickupLat,
      pickup_lng: job.pickupLng,
      radius: 5000,
    });
    if (!Array.isArray(nearbyRiders) || nearbyRiders.length === 0) return;

    const pickupShort = String(job.pickupAddress).split(',')[0] || 'See details';
    const notifications = nearbyRiders.map((r: { id: string }) => ({
      user_id: job.customerId,
      rider_id: r.id,
      type: 'job_request',
      title: 'New delivery request',
      message: `Pickup: ${pickupShort} → Dropoff nearby. Tap to view.`,
      read: false,
      actionable: true,
      delivery_id: job.deliveryId,
    }));
    await job.admin.from('notifications').insert(notifications);

    try {
      await fetch(`${job.supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${job.serviceRoleKey}`,
          apikey: job.serviceRoleKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          riderIds: nearbyRiders.map((r: { id: string }) => r.id),
          title: 'New delivery request',
          body: `Pickup: ${pickupShort} → Dropoff nearby. Tap to accept or decline.`,
          data: { type: 'job_request', deliveryId: job.deliveryId },
          deliveryId: job.deliveryId,
        }),
      });
    } catch (pushErr) {
      console.warn('notifyRidersForDelivery push failed', pushErr);
    }
  } catch (notifyErr) {
    console.warn('notifyRidersForDelivery failed', notifyErr);
  }
}

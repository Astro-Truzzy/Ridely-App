import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  computeServerFare,
  nairaToKobo,
  cardPaymentMatchesQuote,
} from '../_shared/pricing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PaymentMethod = 'cash' | 'card' | 'wallet';

type CreateDeliveryBody = {
  payment_method: PaymentMethod;
  payment_reference?: string | null;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  parcel_size: 'small' | 'medium' | 'large';
  /** Ignored for pricing — server recomputes. Kept for backward compatibility. */
  total_cost?: number;
  distance?: number;
  estimated_time?: string;
  delivery_time: 'now' | 'scheduled';
  scheduled_time?: string | null;
};

function json(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return json({ error: 'Supabase config missing' }, 500);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user: authUser },
    error: authError,
  } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authError || !authUser) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { data: customerProfile } = await userClient
    .from('users')
    .select('id')
    .eq('id', authUser.id)
    .maybeSingle();
  if (!customerProfile) {
    return json({ error: 'Only customers can create deliveries' }, 403);
  }

  let body: CreateDeliveryBody;
  try {
    body = (await req.json()) as CreateDeliveryBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const paymentMethod = body.payment_method;
  if (paymentMethod !== 'cash' && paymentMethod !== 'card') {
    return json(
      {
        error:
          paymentMethod === 'wallet'
            ? 'Wallet payment for bookings is not available yet'
            : 'payment_method must be cash or card',
      },
      400
    );
  }

  const pickupLat = Number(body.pickup_lat);
  const pickupLng = Number(body.pickup_lng);
  const dropoffLat = Number(body.dropoff_lat);
  const dropoffLng = Number(body.dropoff_lng);

  if (
    !body.pickup_address ||
    !body.dropoff_address ||
    !body.parcel_size ||
    !body.delivery_time ||
    !Number.isFinite(pickupLat) ||
    !Number.isFinite(pickupLng) ||
    !Number.isFinite(dropoffLat) ||
    !Number.isFinite(dropoffLng)
  ) {
    return json(
      { error: 'Missing or invalid booking fields (addresses and coordinates required)' },
      400
    );
  }

  const mapsKey =
    Deno.env.get('GOOGLE_MAPS_SERVER_KEY') ||
    Deno.env.get('GOOGLE_MAPS_API_KEY') ||
    null;

  let fare: { distanceKm: number; totalCost: number };
  try {
    fare = await computeServerFare({
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      mapsApiKey: mapsKey,
    });
  } catch (e) {
    console.error('create-delivery fare', e);
    return json({ error: 'Failed to calculate fare' }, 500);
  }

  const totalCost = fare.totalCost;
  const distance = fare.distanceKm;

  if (!(totalCost > 0)) {
    return json({ error: 'Calculated fare is invalid' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  let paymentStatus: 'unpaid' | 'paid' = 'unpaid';
  let paymentReference: string | null = null;
  let amountPaid: number | null = null;

  if (paymentMethod === 'card') {
    const reference = (body.payment_reference || '').trim();
    if (!reference) {
      return json({ error: 'payment_reference required for card bookings' }, 400);
    }

    const { data: existing } = await admin
      .from('deliveries')
      .select('*')
      .eq('payment_reference', reference)
      .maybeSingle();
    if (existing) {
      if (existing.user_id !== authUser.id) {
        return json({ error: 'Payment reference already used' }, 409);
      }
      return json({ delivery: existing, idempotent: true });
    }

    const secret = Deno.env.get('PAYSTACK_SECRET_KEY')?.trim();
    if (!secret) {
      return json({ error: 'PAYSTACK_SECRET_KEY not set' }, 500);
    }

    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    const verifyData = await verifyRes.json();
    if (!verifyData.status || verifyData.data?.status !== 'success') {
      return json(
        { error: verifyData.message || 'Payment not successful' },
        400
      );
    }

    const tx = verifyData.data as {
      amount?: number;
      metadata?: Record<string, string>;
    };
    const meta = tx.metadata ?? {};
    if (meta.user_id && meta.user_id !== authUser.id) {
      return json({ error: 'Payment does not belong to this user' }, 403);
    }
    if (meta.intent && meta.intent !== 'booking') {
      return json({ error: 'Payment was not made for a booking' }, 400);
    }
    if (!meta.intent) {
      return json({ error: 'Payment missing booking intent metadata' }, 400);
    }

    const paidKobo = Number(tx.amount) || 0;
    const expectedKobo = nairaToKobo(totalCost);
    const quotedKobo =
      body.total_cost != null && Number.isFinite(Number(body.total_cost))
        ? nairaToKobo(Number(body.total_cost))
        : expectedKobo;
    if (
      !cardPaymentMatchesQuote({
        paidKobo,
        serverKobo: expectedKobo,
        quotedKobo,
      })
    ) {
      return json(
        {
          error: `Paid amount (₦${(paidKobo / 100).toFixed(2)}) does not match booking total (₦${totalCost.toFixed(2)})`,
        },
        400
      );
    }

    paymentStatus = 'paid';
    paymentReference = reference;
    amountPaid = paidKobo / 100;
  }

  const insertRow = {
    user_id: authUser.id,
    pickup_address: body.pickup_address,
    dropoff_address: body.dropoff_address,
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    dropoff_lat: dropoffLat,
    dropoff_lng: dropoffLng,
    parcel_size: body.parcel_size,
    total_cost: totalCost,
    distance,
    estimated_time: body.estimated_time || '25-35 mins',
    delivery_time: body.delivery_time,
    scheduled_time:
      body.delivery_time === 'scheduled' && body.scheduled_time
        ? body.scheduled_time
        : null,
    payment_method: paymentMethod,
    payment_status: paymentStatus,
    payment_reference: paymentReference,
    amount_paid: amountPaid,
    status: 'pending',
  };

  const { data: delivery, error: insertError } = await admin
    .from('deliveries')
    .insert(insertRow)
    .select()
    .single();

  if (insertError) {
    console.error('create-delivery insert', insertError);
    if (paymentReference && String(insertError.code) === '23505') {
      const { data: raced } = await admin
        .from('deliveries')
        .select('*')
        .eq('payment_reference', paymentReference)
        .maybeSingle();
      if (raced && raced.user_id === authUser.id) {
        return json({ delivery: raced, idempotent: true });
      }
    }
    return json({ error: insertError.message || 'Failed to create delivery' }, 500);
  }

  if (delivery?.id) {
    try {
      const { data: nearbyRiders } = await admin.rpc('find_nearby_riders', {
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        radius: 5000,
      });
      if (Array.isArray(nearbyRiders) && nearbyRiders.length > 0) {
        const pickupShort = String(body.pickup_address).split(',')[0] || 'See details';
        const notifications = nearbyRiders.map((r: { id: string }) => ({
          user_id: authUser.id,
          rider_id: r.id,
          type: 'job_request',
          title: 'New delivery request',
          message: `Pickup: ${pickupShort} → Dropoff nearby. Tap to view.`,
          read: false,
          actionable: true,
          delivery_id: delivery.id,
        }));
        await admin.from('notifications').insert(notifications);

        try {
          await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`,
              apikey: serviceRoleKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              riderIds: nearbyRiders.map((r: { id: string }) => r.id),
              title: 'New delivery request',
              body: `Pickup: ${pickupShort} → Dropoff nearby. Tap to accept or decline.`,
              data: { type: 'job_request', deliveryId: delivery.id },
              deliveryId: delivery.id,
            }),
          });
        } catch (pushErr) {
          console.warn('create-delivery push failed', pushErr);
        }
      }
    } catch (notifyErr) {
      console.warn('create-delivery notify failed', notifyErr);
    }
  }

  return json({ delivery });
});

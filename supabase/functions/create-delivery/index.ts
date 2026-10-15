import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  computeServerFare,
  nairaToKobo,
  cardPaymentMatchesQuote,
  fareQuoteWithinServerBand,
} from '../_shared/pricing.ts';
import { notifyRidersForDelivery } from '../_shared/dispatch.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PaymentMethod = 'card';

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
  /**
   * Client fare quote (from the Google Directions road distance) shown to the
   * customer. Stored as the authoritative fare when it is within a sane band of
   * the server recompute; otherwise the server figure is used.
   */
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

  // Cash-on-delivery is retired for new bookings (Phase 4). Cash rows remain
  // readable for history, but no new delivery may be created unpaid.
  // Bank transfer bookings go through payment-init, never this endpoint.
  const paymentMethod = body.payment_method;
  if (paymentMethod !== 'card') {
    return json(
      {
        error:
          paymentMethod === 'bank_transfer'
            ? 'Bank transfer bookings must be created via payment-init'
            : 'Cash on delivery is no longer supported. Please pay by card or bank transfer.',
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

  let serverFare: {
    distanceKm: number;
    totalCost: number;
    source: 'directions' | 'estimate';
  };
  try {
    serverFare = await computeServerFare({
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

  if (!(serverFare.totalCost > 0)) {
    return json({ error: 'Calculated fare is invalid' }, 400);
  }

  // The customer was shown — and, for card, charged — a fare computed on the
  // client from the Google Directions road distance. This server recompute is
  // an independent anti-tampering reference; when Directions is unavailable
  // server-side it falls back to a straight-line estimate that reads lower,
  // which is why the booked fare used to come out below the quote. Store the
  // quoted fare so the price stays consistent end to end, but only when it is
  // within a sane band of this reference; otherwise fall back to the server
  // figure.
  const serverKobo = nairaToKobo(serverFare.totalCost);
  const quotedCost = Number(body.total_cost);
  const quotedDistance = Number(body.distance);
  const useQuote =
    Number.isFinite(quotedCost) &&
    quotedCost > 0 &&
    fareQuoteWithinServerBand(nairaToKobo(quotedCost), serverKobo);

  const totalCost = useQuote
    ? Number(quotedCost.toFixed(2))
    : serverFare.totalCost;
  const distance =
    useQuote && Number.isFinite(quotedDistance) && quotedDistance >= 0
      ? Number(quotedDistance.toFixed(2))
      : serverFare.distanceKm;

  // Observability: confirm the server key is actually reaching Google
  // Directions. source:'estimate' means it fell back to the straight-line
  // haversine (key missing / app-restricted / API not enabled), which reads
  // lower than the road distance the customer was quoted.
  console.log(
    'create-delivery fare',
    JSON.stringify({
      source: serverFare.source,
      serverDistanceKm: serverFare.distanceKm,
      serverTotal: serverFare.totalCost,
      quotedTotal: Number.isFinite(quotedCost) ? quotedCost : null,
      quotedDistance: Number.isFinite(quotedDistance) ? quotedDistance : null,
      usedQuote: useQuote,
      storedTotal: totalCost,
      storedDistance: distance,
    })
  );

  const admin = createClient(supabaseUrl, serviceRoleKey);

  let paymentStatus: 'unpaid' | 'paid' = 'unpaid';
  let paymentReference: string | null = null;
  let amountPaid: number | null = null;
  let paidKobo = 0;

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

    paidKobo = Number(tx.amount) || 0;
    // Paid amount must match the fare we are about to store (the quote when it
    // is trusted, otherwise the server figure), and that fare must sit within
    // the sane band of the server recompute.
    const bookingKobo = nairaToKobo(totalCost);
    if (
      !cardPaymentMatchesQuote({
        paidKobo,
        serverKobo,
        quotedKobo: bookingKobo,
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

  const deliveryId = (delivery as { id: string }).id;

  // Card bookings share the Phase 2 accounting trail: a successful payments row
  // plus the collection ledger entry. Roll back the delivery if either write
  // fails so a paid booking is never left out of the ledger; the client retry
  // then lands on the idempotent path above.
  {
    const now = new Date().toISOString();
    const { error: paymentRowError } = await admin.from('payments').insert({
      delivery_id: deliveryId,
      customer_id: authUser.id,
      provider: 'paystack',
      method: 'card',
      reference: paymentReference,
      expected_amount_kobo: nairaToKobo(totalCost),
      confirmed_amount_kobo: paidKobo,
      status: 'successful',
      provider_transaction_id: paymentReference,
      confirmed_at: now,
    });
    if (paymentRowError) {
      console.error('create-delivery payments insert', paymentRowError);
      if (String((paymentRowError as { code?: string }).code) === '23505') {
        const { data: raced } = await admin
          .from('deliveries')
          .select('*')
          .eq('payment_reference', paymentReference)
          .maybeSingle();
        if (raced && raced.user_id === authUser.id) {
          return json({ delivery: raced, idempotent: true });
        }
      }
      await admin.from('deliveries').delete().eq('id', deliveryId);
      return json({ error: 'Could not record payment. Please retry.' }, 500);
    }

    const { error: ledgerError } = await admin.from('ledger_entries').insert({
      delivery_id: deliveryId,
      amount_kobo: paidKobo,
      type: 'collection',
      note: `card settlement ref ${paymentReference}`,
    });
    if (ledgerError) {
      console.error('create-delivery ledger insert', ledgerError);
      await admin.from('deliveries').delete().eq('id', deliveryId);
      await admin.from('payments').delete().eq('reference', paymentReference);
      return json({ error: 'Could not record payment. Please retry.' }, 500);
    }
  }

  // Fan out to nearby riders (shared with bank-transfer settlement in the
  // webhook). Best-effort — notification failure never fails the booking.
  await notifyRidersForDelivery({
    admin,
    supabaseUrl,
    serviceRoleKey,
    deliveryId,
    customerId: authUser.id,
    pickupLat,
    pickupLng,
    pickupAddress: body.pickup_address,
  });

  return json({ delivery });
});

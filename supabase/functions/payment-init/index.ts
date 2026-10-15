// Initializes a bank-transfer checkout against Ridely's central collection
// account (Paystack `bank_transfer` checkout channel — funds settle into Ridely's
// Paystack balance; the booking is matched by verified reference, never by
// arrival of money).
//
// Flow: authenticate customer -> authoritative fare -> Paystack initialize
// (bank_transfer channel) -> create delivery (payment_status 'pending', NOT
// dispatched) + pending payments row -> return client-needed fields only.
// Success is NEVER marked here; only the verified webhook settles payment.
//
// If Paystack rejects the initialize call (e.g. the bank_transfer channel is not
// enabled on the account), nothing is written and the provider message is
// surfaced so the capability gap is visible instead of silent.

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  computeServerFare,
  nairaToKobo,
  fareQuoteWithinServerBand,
} from '../_shared/pricing.ts';
import {
  buildInternalReference,
  normalizeIdempotencyKey,
} from '../_shared/checkout.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PaymentInitBody = {
  pickup_address: string;
  dropoff_address: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  parcel_size: 'small' | 'medium' | 'large';
  total_cost?: number;
  distance?: number;
  estimated_time?: string;
  delivery_time: 'now' | 'scheduled';
  scheduled_time?: string | null;
  email: string;
  idempotency_key?: string;
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
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')?.trim();
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return json({ error: 'Supabase config missing' }, 500);
  }
  if (!secret) {
    return json({ error: 'PAYSTACK_SECRET_KEY not set' }, 500);
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

  let body: PaymentInitBody;
  try {
    body = (await req.json()) as PaymentInitBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  let idempotencyKey: string | null = null;
  try {
    idempotencyKey = normalizeIdempotencyKey(body.idempotency_key);
  } catch {
    return json({ error: 'Invalid idempotency key format' }, 400);
  }

  const email = String(body.email ?? '').trim();
  if (!email) {
    return json({ error: 'email is required for bank transfer checkout' }, 400);
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

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const internalRef = buildInternalReference(idempotencyKey);

  // Idempotent retry: same key returns the pending checkout without new rows.
  {
    const { data: existing } = await admin
      .from('payments')
      .select('id, reference, expected_amount_kobo, status, delivery_id, provider_transaction_id')
      .eq('reference', internalRef)
      .maybeSingle();
    if (existing) {
      const row = existing as {
        status: string;
        reference: string;
        expected_amount_kobo: number;
        delivery_id: string;
        provider_transaction_id: string | null;
      };
      if (row.status !== 'pending') {
        return json(
          { error: `This payment is already ${row.status}`, reference: row.reference },
          409
        );
      }
      return json({
        reference: row.reference,
        delivery_id: row.delivery_id,
        amount_kobo: row.expected_amount_kobo,
        provider_reference: row.provider_transaction_id,
        idempotent: true,
      });
    }
  }

  // Authoritative fare (same band-checked quote rule as create-delivery).
  const mapsKey =
    Deno.env.get('GOOGLE_MAPS_SERVER_KEY') ||
    Deno.env.get('GOOGLE_MAPS_API_KEY') ||
    null;
  let serverFare: { distanceKm: number; totalCost: number };
  try {
    serverFare = await computeServerFare({
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      mapsApiKey: mapsKey,
    });
  } catch (e) {
    console.error('payment-init fare', e);
    return json({ error: 'Failed to calculate fare' }, 500);
  }
  if (!(serverFare.totalCost > 0)) {
    return json({ error: 'Calculated fare is invalid' }, 400);
  }
  const serverKobo = nairaToKobo(serverFare.totalCost);
  const quotedCost = Number(body.total_cost);
  const quotedDistance = Number(body.distance);
  const useQuote =
    Number.isFinite(quotedCost) &&
    quotedCost > 0 &&
    fareQuoteWithinServerBand(nairaToKobo(quotedCost), serverKobo);
  const totalCost = useQuote ? Number(quotedCost.toFixed(2)) : serverFare.totalCost;
  const distance =
    useQuote && Number.isFinite(quotedDistance) && quotedDistance >= 0
      ? Number(quotedDistance.toFixed(2))
      : serverFare.distanceKm;
  const amountKobo = nairaToKobo(totalCost);

  // Initialize with Paystack FIRST: if the bank_transfer channel is unavailable
  // on this account the call fails here and nothing is persisted.
  let paystackRef: string;
  let authorizationUrl: string;
  let accessCode: string;
  try {
    const initRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        callback_url: `${supabaseUrl}/functions/v1/paystack-callback`,
        metadata: {
          user_id: authUser.id,
          intent: 'booking',
          method: 'bank_transfer',
          internal_ref: internalRef,
        },
        channels: ['bank_transfer'],
      }),
    });
    const initData = await initRes.json();
    if (!initData.status) {
      console.error('payment-init Paystack error:', initData.message, initData);
      return json(
        {
          error:
            'Bank transfer checkout is not available right now. ' +
            (initData.message || 'Please try card payment or contact support.'),
        },
        400
      );
    }
    paystackRef = initData.data.reference;
    authorizationUrl = initData.data.authorization_url;
    accessCode = initData.data.access_code;
    if (!paystackRef || !authorizationUrl) {
      return json({ error: 'Bank transfer checkout returned an invalid response' }, 500);
    }
  } catch (e) {
    console.error('payment-init initialize failed', e);
    return json({ error: 'Could not start bank transfer checkout' }, 500);
  }

  // Persist delivery (pending payment — NOT dispatched) + pending payment row.
  const { data: delivery, error: deliveryError } = await admin
    .from('deliveries')
    .insert({
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
      payment_method: 'bank_transfer',
      payment_status: 'pending',
      payment_reference: paystackRef,
      amount_paid: null,
      status: 'pending',
    })
    .select('id')
    .single();

  if (deliveryError || !delivery) {
    console.error('payment-init delivery insert', deliveryError);
    return json(
      { error: 'Could not create booking. The Paystack transaction was not linked — please retry.' },
      500
    );
  }

  const deliveryId = (delivery as { id: string }).id;
  const { error: paymentError } = await admin.from('payments').insert({
    delivery_id: deliveryId,
    customer_id: authUser.id,
    provider: 'paystack',
    method: 'bank_transfer',
    reference: internalRef,
    expected_amount_kobo: amountKobo,
    status: 'pending',
    provider_transaction_id: paystackRef,
  });
  if (paymentError) {
    console.error('payment-init payments insert', paymentError);
    // Roll back the orphan delivery so it can never dispatch without a payment row.
    await admin.from('deliveries').delete().eq('id', deliveryId);
    return json({ error: 'Could not create booking. Please retry.' }, 500);
  }

  return json({
    reference: internalRef,
    delivery_id: deliveryId,
    amount_kobo: amountKobo,
    provider_reference: paystackRef,
    authorization_url: authorizationUrl,
    access_code: accessCode,
  });
});

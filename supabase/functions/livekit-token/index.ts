import { createClient } from 'npm:@supabase/supabase-js@2';
import { AccessToken } from 'npm:livekit-server-sdk@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACTIVE_STATUSES = new Set([
  'rider_assigned',
  'accepted',
  'picked_up',
  'in_transit',
  'nearby',
]);

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
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
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const livekitApiKey = Deno.env.get('LIVEKIT_API_KEY') ?? '';
  const livekitApiSecret = Deno.env.get('LIVEKIT_API_SECRET') ?? '';
  const livekitUrl = Deno.env.get('LIVEKIT_URL') ?? '';

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ error: 'Server misconfiguration' }, 500);
  }
  if (!livekitApiKey || !livekitApiSecret || !livekitUrl) {
    return jsonResponse({ error: 'Voice calls are not configured on the server' }, 503);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body: { deliveryId?: string };
  try {
    body = (await req.json()) as { deliveryId?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const deliveryId = String(body.deliveryId ?? '').trim();
  if (!deliveryId) {
    return jsonResponse({ error: 'deliveryId is required' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: delivery, error: deliveryError } = await admin
    .from('deliveries')
    .select('id, user_id, rider_id, status')
    .eq('id', deliveryId)
    .maybeSingle();

  if (deliveryError || !delivery) {
    return jsonResponse({ error: 'Delivery not found' }, 404);
  }

  const userId = authData.user.id;
  const isCustomer = delivery.user_id === userId;
  const isRider = delivery.rider_id === userId;
  if (!isCustomer && !isRider) {
    return jsonResponse({ error: 'Not allowed to join this call' }, 403);
  }
  if (!delivery.rider_id) {
    return jsonResponse({ error: 'A rider must be assigned before calling' }, 400);
  }
  if (!ACTIVE_STATUSES.has(delivery.status)) {
    return jsonResponse({ error: 'Voice calls are only available during active deliveries' }, 400);
  }

  let displayName = authData.user.email?.split('@')[0] ?? 'Ridely user';
  if (isRider) {
    const { data: rider } = await admin
      .from('riders')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle();
    if (rider?.full_name) displayName = rider.full_name;
  } else {
    const { data: customer } = await admin
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle();
    if (customer?.full_name) displayName = customer.full_name;
  }

  const roomName = `delivery-${deliveryId}`;
  const token = new AccessToken(livekitApiKey, livekitApiSecret, {
    identity: userId,
    name: displayName,
    ttl: '2h',
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const jwt = await token.toJwt();

  return jsonResponse({
    token: jwt,
    serverUrl: livekitUrl,
    roomName,
  });
});

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type DeliveryRow = {
  id: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  estimated_time: string | null;
  rider_id: string | null;
  proof_photo_path: string | null;
  share_token: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token')?.trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'token query param required' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: delivery, error } = await supabase
    .from('deliveries')
    .select(
      'id, status, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, estimated_time, rider_id, proof_photo_path, share_token'
    )
    .eq('share_token', token)
    .maybeSingle();

  if (error || !delivery) {
    return new Response(JSON.stringify({ error: 'Tracking link not found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404,
    });
  }

  const d = delivery as DeliveryRow;
  const liveStatuses = new Set([
    'accepted',
    'rider_assigned',
    'picked_up',
    'in_transit',
    'nearby',
  ]);
  const isLive = liveStatuses.has(d.status);

  let riderName: string | null = null;
  let riderLat: number | null = null;
  let riderLng: number | null = null;

  if (d.rider_id) {
    const { data: rider } = await supabase
      .from('riders')
      .select('full_name')
      .eq('id', d.rider_id)
      .maybeSingle();
    riderName = (rider as { full_name?: string } | null)?.full_name?.split(' ')[0] ?? 'Rider';

    if (isLive) {
      const { data: loc } = await supabase
        .from('rider_locations')
        .select('latitude, longitude')
        .eq('rider_id', d.rider_id)
        .maybeSingle();
      if (loc) {
        riderLat = (loc as { latitude: number }).latitude;
        riderLng = (loc as { longitude: number }).longitude;
      }
    }
  }

  let proofPhotoUrl: string | null = null;
  if (d.proof_photo_path) {
    const { data: signed } = await supabase.storage
      .from('delivery-proofs')
      .createSignedUrl(d.proof_photo_path, 3600);
    proofPhotoUrl = signed?.signedUrl ?? null;
  }

  const payload = {
    status: d.status,
    pickupAddress: d.pickup_address,
    dropoffAddress: d.dropoff_address,
    pickupLat: d.pickup_lat,
    pickupLng: d.pickup_lng,
    dropoffLat: d.dropoff_lat,
    dropoffLng: d.dropoff_lng,
    estimatedTime: d.estimated_time,
    riderName,
    riderLat,
    riderLng,
    proofPhotoUrl,
    updatedAt: new Date().toISOString(),
  };

  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
});

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendPushBody {
  riderIds?: string[];
  userIds?: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

type DeliveryRow = { user_id: string; rider_id: string | null };

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonResponse({ error: 'Server misconfiguration' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice('Bearer '.length);
  const isServiceRoleCaller = token === serviceKey;

  const adminClient = createClient(supabaseUrl, serviceKey);
  let actorUserId: string | null = null;
  if (!isServiceRoleCaller) {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await authClient.auth.getUser();
    if (error || !data.user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    actorUserId = data.user.id;
  }

  try {
    const body = (await req.json()) as SendPushBody;
    const riderIds = Array.isArray(body.riderIds) ? body.riderIds.filter(Boolean) : [];
    const userIds = Array.isArray(body.userIds) ? body.userIds.filter(Boolean) : [];
    const data = body.data && typeof body.data === 'object' ? body.data : {};
    const title = String(body.title || '').trim();
    const messageBody = String(body.body || '').trim();

    const targetIds = [...new Set([...riderIds, ...userIds])];
    if (targetIds.length === 0 || !title) {
      return jsonResponse({ error: 'riderIds or userIds and title required' }, 400);
    }
    if (targetIds.length > 100) {
      return jsonResponse({ error: 'Too many recipients in one request (max 100)' }, 400);
    }
    if (riderIds.length > 0 && userIds.length > 0) {
      return jsonResponse({ error: 'Provide riderIds or userIds, not both' }, 400);
    }

    // Non-service callers are restricted to their own delivery context.
    if (!isServiceRoleCaller && actorUserId) {
      const deliveryId = typeof data.deliveryId === 'string' ? data.deliveryId : null;
      if (!deliveryId) {
        return jsonResponse({ error: 'deliveryId is required for authenticated client calls' }, 403);
      }
      const { data: delivery, error: deliveryError } = await adminClient
        .from('deliveries')
        .select('user_id, rider_id')
        .eq('id', deliveryId)
        .maybeSingle();
      if (deliveryError || !delivery) {
        return jsonResponse({ error: 'Delivery not found for authorization check' }, 403);
      }
      const d = delivery as DeliveryRow;

      // Customer can only notify riders for their own delivery.
      if (riderIds.length > 0) {
        if (d.user_id !== actorUserId) {
          return jsonResponse({ error: 'Forbidden recipient scope' }, 403);
        }
      }

      // Rider can only notify the customer of their own assigned delivery.
      if (userIds.length > 0) {
        if (d.rider_id !== actorUserId) {
          return jsonResponse({ error: 'Forbidden recipient scope' }, 403);
        }
        if (userIds.some((uid) => uid !== d.user_id)) {
          return jsonResponse({ error: 'Recipients must match the delivery owner' }, 403);
        }
      }
    }

    const { data: tokens, error: fetchError } = await adminClient
      .from('push_tokens')
      .select('expo_push_token')
      .in('user_id', targetIds);

    if (fetchError) {
      console.error('send-push fetch tokens error', fetchError);
      return jsonResponse({ error: 'Failed to fetch push tokens' }, 500);
    }

    const expoTokens = (tokens ?? [])
      .map((r: { expo_push_token: string }) => r.expo_push_token)
      .filter(Boolean);
    if (expoTokens.length === 0) {
      return jsonResponse({ sent: 0, message: 'No push tokens found' });
    }

    const messages = expoTokens.map((to: string) => ({
      to,
      sound: 'default' as const,
      channelId: 'default',
      title,
      body: messageBody,
      data,
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Expo push API error', res.status, errText);
      return jsonResponse({ error: 'Expo push failed', details: errText }, 502);
    }

    const result = await res.json();
    const sent = Array.isArray(result) ? result.length : 0;
    return jsonResponse({
      sent,
      receiptIds: Array.isArray(result) ? result.map((r: { id?: string }) => r?.id) : [],
    });
  } catch (err) {
    console.error('send-push error', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});

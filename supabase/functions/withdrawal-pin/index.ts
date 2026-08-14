import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

function parseRpcJson(data: unknown): Record<string, unknown> {
  if (data == null) return {};
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {};
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: 'Server misconfiguration' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const userId = authData.user.id;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  if (req.method === 'GET') {
    const { data, error } = await admin.rpc('withdrawal_pin_status', { p_user_id: userId });
    if (error) {
      console.error('withdrawal-pin status error', error);
      return json({ error: 'Could not load PIN status' }, 500);
    }
    const status = parseRpcJson(data);
    return json(Object.keys(status).length ? status : { has_pin: false });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: { pin?: string; current_pin?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const pin = String(body.pin ?? '').trim();
  const currentPin = body.current_pin != null ? String(body.current_pin).trim() : '';

  const rpcArgs: { p_user_id: string; p_pin: string; p_current_pin?: string } = {
    p_user_id: userId,
    p_pin: pin,
  };
  // Omit null current PIN so PostgREST can match the DEFAULT NULL signature.
  if (currentPin) {
    rpcArgs.p_current_pin = currentPin;
  }

  const { data, error } = await admin.rpc('set_withdrawal_pin', rpcArgs);

  if (error) {
    console.error('withdrawal-pin set error', error);
    return json({ error: 'Could not save PIN' }, 500);
  }

  const result = parseRpcJson(data);
  if (!result?.success) {
    return json({ error: result?.error ?? 'Could not save PIN' }, 400);
  }

  return json({ success: true, message: 'Withdrawal PIN saved' });
});

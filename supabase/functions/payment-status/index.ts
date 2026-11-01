// Authenticated payment-status read for the bank-transfer waiting screen.
// Returns the backend payment + delivery state for an internal RDL- reference.
// Customers may only read their own payments; success here reflects the
// verified webhook/settlement, never a client claim.

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
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: 'Supabase config missing' }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authError || !authUser) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(req.url);
  const reference =
    url.searchParams.get('reference')?.trim() ||
    ((await req.json().catch(() => null)) as { reference?: string } | null)?.reference?.trim();

  if (!reference) {
    return json({ error: 'reference required' }, 400);
  }

  const { data: payment } = await supabase
    .from('payments')
    .select('reference, status, expected_amount_kobo, confirmed_amount_kobo, method, delivery_id, failure_reason')
    .eq('reference', reference)
    .eq('customer_id', authUser.id)
    .maybeSingle();

  if (!payment) {
    return json({ error: 'Payment not found' }, 404);
  }

  const row = payment as {
    reference: string;
    status: string;
    expected_amount_kobo: number;
    confirmed_amount_kobo: number | null;
    method: string;
    delivery_id: string;
    failure_reason: string | null;
  };

  const { data: delivery } = await supabase
    .from('deliveries')
    .select('id, status, payment_status')
    .eq('id', row.delivery_id)
    .maybeSingle();

  return json({
    reference: row.reference,
    status: row.status,
    method: row.method,
    expected_amount_kobo: row.expected_amount_kobo,
    confirmed_amount_kobo: row.confirmed_amount_kobo,
    failure_reason: row.failure_reason,
    delivery: delivery ?? null,
  });
});

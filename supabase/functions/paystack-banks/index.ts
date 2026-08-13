// Lists Nigerian banks and resolves account names via Paystack.
// GET  ?action=list                              -> { banks: [{ name, code }] }
// GET  ?action=resolve&account=..&bank_code=..   -> { account_name }

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

  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')?.trim();
  if (!secret) {
    return json({ error: 'PAYSTACK_SECRET_KEY not set' }, 500);
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'list';

  try {
    if (action === 'list') {
      const res = await fetch('https://api.paystack.co/bank?currency=NGN&perPage=100', {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await res.json();
      if (!data.status) {
        return json({ error: data.message || 'Failed to fetch banks' }, 400);
      }
      const banks = (data.data as { name: string; code: string }[]).map((b) => ({
        name: b.name,
        code: b.code,
      }));
      return json({ banks });
    }

    if (action === 'resolve') {
      const account = url.searchParams.get('account')?.trim();
      const bankCode = url.searchParams.get('bank_code')?.trim();
      if (!account || !bankCode) {
        return json({ error: 'account and bank_code required' }, 400);
      }
      const res = await fetch(
        `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(account)}&bank_code=${encodeURIComponent(bankCode)}`,
        { headers: { Authorization: `Bearer ${secret}` } }
      );
      const data = await res.json();
      if (!data.status) {
        return json({ error: data.message || 'Could not resolve account' }, 400);
      }
      return json({ account_name: data.data.account_name });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('paystack-banks', e);
    return json({ error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
});

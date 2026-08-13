import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const userId = authData.user.id;

  let body: { code?: string };
  try {
    body = (await req.json()) as { code?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  const code = String(body.code ?? '').trim().toUpperCase();
  if (!code) {
    return new Response(JSON.stringify({ error: 'Promo code required' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: promo, error: promoError } = await admin
    .from('promo_codes')
    .select('id, code, credit_amount, max_redemptions, per_user_limit, expires_at, active')
    .eq('code', code)
    .maybeSingle();

  if (promoError || !promo) {
    return new Response(JSON.stringify({ error: 'Invalid promo code' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404,
    });
  }

  const p = promo as {
    id: string;
    credit_amount: number;
    max_redemptions: number | null;
    per_user_limit: number;
    expires_at: string | null;
    active: boolean;
  };

  if (!p.active) {
    return new Response(JSON.stringify({ error: 'This promo code is no longer active' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  if (p.expires_at && new Date(p.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: 'This promo code has expired' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  const { count: totalRedemptions } = await admin
    .from('promo_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('promo_id', p.id);

  if (p.max_redemptions != null && (totalRedemptions ?? 0) >= p.max_redemptions) {
    return new Response(JSON.stringify({ error: 'This promo code has reached its redemption limit' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  const { count: userRedemptions } = await admin
    .from('promo_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('promo_id', p.id)
    .eq('user_id', userId);

  if ((userRedemptions ?? 0) >= p.per_user_limit) {
    return new Response(JSON.stringify({ error: 'You have already redeemed this promo code' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  const reference = `promo:${p.id}:${userId}`;
  const { data: existingTx } = await admin
    .from('transactions')
    .select('id')
    .eq('reference', reference)
    .maybeSingle();

  if (existingTx) {
    return new Response(JSON.stringify({ error: 'Promo already redeemed', credited: p.credit_amount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  const amount = Number(p.credit_amount);

  const { error: txError } = await admin.from('transactions').insert({
    user_id: userId,
    amount,
    type: 'credit',
    category: 'promo_credit',
    provider: 'internal',
    provider_reference: reference,
    metadata: {
      promo_id: p.id,
      promo_code: code,
    },
    reference,
    status: 'success',
  });

  if (txError) {
    console.error('redeem-promo: transaction insert error', txError);
    return new Response(JSON.stringify({ error: 'Failed to record transaction' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  const { error: redemptionError } = await admin.from('promo_redemptions').insert({
    promo_id: p.id,
    user_id: userId,
    amount,
  });

  if (redemptionError) {
    console.error('redeem-promo: redemption insert error', redemptionError);
    return new Response(JSON.stringify({ error: 'Failed to record redemption' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  const { error: creditError } = await admin.rpc('credit_wallet', {
    p_user_id: userId,
    p_amount: amount,
  });
  if (creditError) {
    console.error('redeem-promo: credit_wallet rpc error', creditError);
    return new Response(JSON.stringify({ error: 'Failed to credit wallet' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  return new Response(
    JSON.stringify({ success: true, credited: amount, message: `₦${amount.toLocaleString()} added to your wallet` }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
});

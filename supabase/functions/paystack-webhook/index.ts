import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

async function verifyPaystackSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex === signature;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secret) {
    console.error('paystack-webhook: PAYSTACK_SECRET_KEY not set');
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  const signature = req.headers.get('x-paystack-signature') ?? '';
  const rawBody = await req.text();
  if (!rawBody || !signature) {
    return new Response(JSON.stringify({ error: 'Missing body or signature' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const isValid = await verifyPaystackSignature(rawBody, signature, secret);
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  let event: { event?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody) as { event?: string; data?: Record<string, unknown> };
  } catch {
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  if (event.event !== 'charge.success') {
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  const data = event.data as {
    reference?: string;
    amount?: number;
    authorization?: {
      authorization_code?: string;
      last4?: string;
      exp_month?: string;
      exp_year?: string;
      brand?: string;
    };
    metadata?: Record<string, string>;
  } | undefined;

  if (!data?.reference || !data?.authorization?.authorization_code) {
    console.error('paystack-webhook: missing reference or authorization in event.data', data);
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  const userId = (data.metadata?.user_id ?? (event as { metadata?: Record<string, string> }).metadata?.user_id) as string | undefined;
  if (!userId) {
    console.error('paystack-webhook: missing user_id in metadata', data.metadata);
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('paystack-webhook: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: existing } = await supabase
    .from('transactions')
    .select('id')
    .eq('reference', data.reference)
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  const auth = data.authorization;
  const amountKobo = Number(data.amount) || 0;
  const amountNaira = amountKobo / 100;

  const { error: cardError } = await supabase
    .from('saved_cards')
    .upsert(
      {
        user_id: userId,
        authorization_code: auth.authorization_code,
        last4: auth.last4 ?? null,
        exp_month: auth.exp_month != null ? String(auth.exp_month) : null,
        exp_year: auth.exp_year != null ? String(auth.exp_year) : null,
        brand: auth.brand ?? null,
      },
      { onConflict: 'user_id,authorization_code', ignoreDuplicates: false }
    );

  if (cardError) {
    console.error('paystack-webhook: saved_cards upsert error', cardError);
  }

  const { error: txError } = await supabase.from('transactions').insert({
    user_id: userId,
    amount: amountNaira,
    type: 'credit',
    reference: data.reference,
    status: 'success',
  });

  if (txError) {
    console.error('paystack-webhook: transactions insert error', txError);
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  const intent = (data.metadata?.intent ?? (event as { metadata?: Record<string, string> }).metadata?.intent) as string | undefined;
  if (intent === 'fund_wallet') {
    const { data: wallet } = await supabase
      .from('users_wallet')
      .select('id, balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (wallet) {
      await supabase
        .from('users_wallet')
        .update({
          balance: Number(wallet.balance) + amountNaira,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    } else {
      await supabase.from('users_wallet').insert({
        user_id: userId,
        balance: amountNaira,
      });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
});

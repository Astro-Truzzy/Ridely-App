import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    );
  }

  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secret) {
    return new Response(
      JSON.stringify({ error: 'PAYSTACK_SECRET_KEY not set' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ error: 'Supabase config missing' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authError || !authUser) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    );
  }

  try {
    const body = await req.json();
    const {
      authorization_code,
      saved_card_id,
      payment_method_id,
      email,
      amount_in_kobo,
      reference: idempotencyRef,
    } = body as {
      authorization_code?: string;
      saved_card_id?: string;
      payment_method_id?: string;
      email?: string;
      amount_in_kobo: number;
      reference?: string;
    };

    let code = authorization_code;
    let chargeEmail = email ?? authUser.email ?? '';

    if (payment_method_id && !code) {
      const { data: pm, error: pmError } = await supabase
        .from('payment_methods')
        .select('gateway_payment_method_id')
        .eq('id', payment_method_id)
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (pmError || !pm?.gateway_payment_method_id) {
        return new Response(
          JSON.stringify({ error: 'Payment method not found or card not chargeable' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      code = pm.gateway_payment_method_id;
    }

    if (saved_card_id && !code) {
      const { data: card, error: cardError } = await supabase
        .from('saved_cards')
        .select('authorization_code')
        .eq('id', saved_card_id)
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (cardError || !card) {
        return new Response(
          JSON.stringify({ error: 'Card not found or access denied' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      code = card.authorization_code;
    }

    if (!code || !chargeEmail || amount_in_kobo == null || amount_in_kobo < 100) {
      return new Response(
        JSON.stringify({
          error:
            'authorization_code (or payment_method_id / saved_card_id), email, and amount_in_kobo (min 100) required',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const res = await fetch('https://api.paystack.co/transaction/charge_authorization', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authorization_code: code,
        email: chargeEmail,
        amount: Number(amount_in_kobo),
        ...(idempotencyRef ? { reference: idempotencyRef } : {}),
      }),
    });

    const data = await res.json();
    if (!data.status) {
      return new Response(
        JSON.stringify({
          success: false,
          error: data.message ?? 'Charge failed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const tx = data.data as { status?: string; reference?: string; amount?: number };
    const success = tx.status === 'success';

    if (success && tx.reference) {
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      if (serviceRoleKey) {
        const admin = createClient(supabaseUrl, serviceRoleKey);
        const amountNaira = (tx.amount ?? amount_in_kobo) / 100;
        await admin.from('transactions').insert({
          user_id: authUser.id,
          amount: amountNaira,
          type: 'debit',
          reference: tx.reference,
          status: 'success',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success,
        data: data.data,
        error: success ? undefined : (data.message ?? 'Charge failed'),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e) {
    console.error('paystack-charge', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

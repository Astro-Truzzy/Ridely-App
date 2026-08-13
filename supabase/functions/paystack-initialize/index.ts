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

  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')?.trim();
  if (!secret) {
    return new Response(
      JSON.stringify({ error: 'PAYSTACK_SECRET_KEY not set. Add it under Project Settings → Edge Functions → Secrets, then redeploy this function.' }),
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
    const { amount_in_kobo, email, callback_url, metadata, channels } = body as {
      amount_in_kobo: number;
      email: string;
      callback_url?: string;
      metadata?: Record<string, string>;
      channels?: string[];
    };

    if (!email || amount_in_kobo == null || amount_in_kobo < 100) {
      return new Response(
        JSON.stringify({ error: 'email and amount_in_kobo (min 100) required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Bind identity from auth — never trust client user_id
    const safeMetadata: Record<string, string> = {
      ...(metadata && typeof metadata === 'object' ? metadata : {}),
      user_id: authUser.id,
    };
    delete (safeMetadata as { userId?: string }).userId;

    const defaultCallback = `${supabaseUrl}/functions/v1/paystack-callback`;

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Number(amount_in_kobo),
        callback_url: callback_url || defaultCallback,
        metadata: safeMetadata,
        channels: Array.isArray(channels) && channels.length > 0 ? channels : ['card'],
      }),
    });

    const data = await res.json();
    if (!data.status) {
      const paystackMessage = data.message || 'Paystack initialize failed';
      console.error('paystack-initialize Paystack error:', paystackMessage, data);
      return new Response(
        JSON.stringify({ error: paystackMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    return new Response(
      JSON.stringify({
        authorization_url: data.data.authorization_url,
        reference: data.data.reference,
        access_code: data.data.access_code,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e) {
    console.error('paystack-initialize', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

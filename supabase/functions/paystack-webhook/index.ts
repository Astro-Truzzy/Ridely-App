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
  const ok = (payload: Record<string, unknown> = { received: true }) =>
    new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  if (event.event === 'transfer.success' || event.event === 'transfer.failed' || event.event === 'transfer.reversed') {
    const transferData = event.data as {
      reference?: string;
      reason?: string;
      transfer_code?: string;
    } | undefined;
    const reference = transferData?.reference;
    if (!reference) return ok();

    const { data: payout } = await supabase
      .from('rider_payout_requests')
      .select('status, earning_ids')
      .eq('reference', reference)
      .maybeSingle();

    if (payout) {
      const payoutStatus = String((payout as { status?: string }).status ?? '');
      const earningIds = ((payout as { earning_ids?: string[] }).earning_ids ?? []) as string[];

      if (event.event === 'transfer.success') {
        await supabase
          .from('rider_payout_requests')
          .update({
            status: 'transfer_success',
            failure_reason: null,
            transfer_code: transferData?.transfer_code ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('reference', reference);
        return ok({ received: true, type: 'transfer.success', kind: 'rider_payout' });
      }

      const alreadyReleased =
        payoutStatus === 'transfer_failed_released' || payoutStatus === 'transfer_reversed_released';
      if (!alreadyReleased && earningIds.length > 0) {
        const { error: releaseError } = await supabase.rpc('release_rider_earnings', {
          p_earning_ids: earningIds,
        });
        if (releaseError) {
          console.error('paystack-webhook: release_rider_earnings rpc error', releaseError);
        }
      }

      await supabase
        .from('rider_payout_requests')
        .update({
          status:
            event.event === 'transfer.reversed'
              ? 'transfer_reversed_released'
              : 'transfer_failed_released',
          failure_reason: transferData?.reason || 'Transfer failed',
          transfer_code: transferData?.transfer_code ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('reference', reference);
      return ok({ received: true, type: event.event, kind: 'rider_payout' });
    }

    const { data: withdrawal } = await supabase
      .from('withdrawal_requests')
      .select('user_id, amount, status')
      .eq('reference', reference)
      .maybeSingle();
    if (!withdrawal) return ok();

    if (event.event === 'transfer.success') {
      await supabase
        .from('withdrawal_requests')
        .update({
          status: 'transfer_success',
          failure_reason: null,
          transfer_code: transferData?.transfer_code ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('reference', reference);

      await supabase.from('transactions').update({ status: 'success' }).eq('reference', reference);
      await supabase
        .from('transactions')
        .update({
          category: 'wallet_withdrawal',
          provider: 'paystack',
          provider_reference: transferData?.transfer_code ?? reference,
        })
        .eq('reference', reference);
      return ok({ received: true, type: 'transfer.success' });
    }

    const currentStatus = String((withdrawal as { status?: string }).status ?? '');
    const alreadyRefunded =
      currentStatus === 'transfer_failed_refunded' || currentStatus === 'transfer_reversed_refunded';
    if (!alreadyRefunded) {
      const { error: refundError } = await supabase.rpc('credit_wallet', {
        p_user_id: (withdrawal as { user_id: string }).user_id,
        p_amount: Number((withdrawal as { amount: number }).amount),
      });
      if (refundError) {
        console.error('paystack-webhook: refund credit_wallet rpc error', refundError);
      }
    }

    await supabase
      .from('withdrawal_requests')
      .update({
        status: event.event === 'transfer.reversed' ? 'transfer_reversed_refunded' : 'transfer_failed_refunded',
        failure_reason: transferData?.reason || 'Transfer failed',
        transfer_code: transferData?.transfer_code ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('reference', reference);

    await supabase
      .from('transactions')
      .update({ status: event.event === 'transfer.reversed' ? 'reversed' : 'failed' })
      .eq('reference', reference);
    return ok({ received: true, type: event.event });
  }

  if (event.event !== 'charge.success') {
    return ok();
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
    return ok();
  }

  const userId = (data.metadata?.user_id ?? (event as { metadata?: Record<string, string> }).metadata?.user_id) as string | undefined;
  if (!userId) {
    console.error('paystack-webhook: missing user_id in metadata', data.metadata);
    return ok();
  }

  const { data: existing } = await supabase
    .from('transactions')
    .select('id')
    .eq('reference', data.reference)
    .maybeSingle();

  if (existing) {
    return ok({ received: true, duplicate: true });
  }

  const auth = data.authorization;
  const amountKobo = Number(data.amount) || 0;
  const amountNaira = amountKobo / 100;
  const intent = (data.metadata?.intent ?? (event as { metadata?: Record<string, string> }).metadata?.intent) as string | undefined;

  // Do not create deliveries here — create-delivery edge function owns that.
  // Classify transaction by intent so booking charges are not treated as card_authorization.
  let category = 'card_authorization';
  let txType: 'credit' | 'debit' = 'credit';
  if (intent === 'fund_wallet') {
    category = 'wallet_topup';
    txType = 'credit';
  } else if (intent === 'booking') {
    category = 'booking_charge';
    txType = 'debit';
  }

  // Save card for checkout / add-card flows; still useful after booking charges
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
    type: txType,
    category,
    provider: 'paystack',
    provider_reference: data.reference,
    metadata: {
      paystack_event: event.event,
      intent: intent ?? null,
      authorization_last4: auth.last4 ?? null,
      authorization_brand: auth.brand ?? null,
    },
    reference: data.reference,
    status: 'success',
  });

  if (txError) {
    // Duplicate from paystack-charge is expected for saved-card bookings
    console.error('paystack-webhook: transactions insert error', txError);
    return ok();
  }

  if (intent === 'fund_wallet') {
    const { error: creditError } = await supabase.rpc('credit_wallet', {
      p_user_id: userId,
      p_amount: amountNaira,
    });
    if (creditError) {
      console.error('paystack-webhook: credit_wallet rpc error', creditError);
    }
  }

  return ok();
});

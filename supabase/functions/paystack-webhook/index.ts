import { createClient } from 'npm:@supabase/supabase-js@2';
import { notifyRidersForDelivery } from '../_shared/dispatch.ts';

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

  const fmtNaira = (n: number) =>
    `\u20a6${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // In-app receipt + push. Never throws — receipts must not break settlement.
  const sendReceipt = async (opts: {
    userId: string;
    riderId?: string | null;
    title: string;
    message: string;
  }) => {
    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: opts.userId,
        rider_id: opts.riderId ?? null,
        type: 'payment',
        title: opts.title,
        message: opts.message,
        read: false,
        actionable: false,
      });
      if (error) console.error('paystack-webhook: receipt notification insert failed', error);
    } catch (e) {
      console.error('paystack-webhook: receipt notification insert failed', e);
    }
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          opts.riderId
            ? { riderIds: [opts.riderId], title: opts.title, body: opts.message }
            : { userIds: [opts.userId], title: opts.title, body: opts.message }
        ),
      });
    } catch (e) {
      console.error('paystack-webhook: receipt push failed', e);
    }
  };

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
      .select('id, status, earning_ids, rider_id, amount, amount_kobo, batch_id')
      .eq('reference', reference)
      .maybeSingle();

    if (payout) {
      const payoutStatus = String((payout as { status?: string }).status ?? '');
      const earningIds = ((payout as { earning_ids?: string[] }).earning_ids ?? []) as string[];
      const payoutRiderId = String((payout as { rider_id?: string }).rider_id ?? '');
      const payoutId = String((payout as { id?: string }).id ?? '');
      const payoutKobo =
        Number((payout as { amount_kobo?: number }).amount_kobo) ||
        Math.round(Number((payout as { amount?: number }).amount ?? 0) * 100);
      const payoutBatchId =
        (payout as { batch_id?: string | null }).batch_id ?? null;

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

        // Payout ledger row (idempotent) + batch paid total. Append-only —
        // the trigger forbids duplicates only via this existence check.
        if (payoutId && payoutKobo > 0) {
          const { data: existingPayoutLedger } = await supabase
            .from('ledger_entries')
            .select('id')
            .eq('payout_id', payoutId)
            .eq('type', 'payout')
            .limit(1);
          if (!existingPayoutLedger || existingPayoutLedger.length === 0) {
            await supabase.from('ledger_entries').insert({
              payout_id: payoutId,
              amount_kobo: -payoutKobo,
              type: 'payout',
              note: `rider transfer ref ${reference}`,
            });
          }
        }
        if (payoutBatchId && payoutKobo > 0) {
          const { data: batchRow } = await supabase
            .from('payout_batches')
            .select('paid_amount_kobo')
            .eq('id', payoutBatchId)
            .maybeSingle();
          if (batchRow) {
            await supabase
              .from('payout_batches')
              .update({
                paid_amount_kobo:
                  Number((batchRow as { paid_amount_kobo?: number }).paid_amount_kobo ?? 0) +
                  payoutKobo,
              })
              .eq('id', payoutBatchId);
          }
        }

        if (payoutRiderId && payoutStatus !== 'transfer_success') {
          await sendReceipt({
            userId: payoutRiderId,
            riderId: payoutRiderId,
            title: 'Payout successful',
            message: `${fmtNaira(payoutKobo / 100)} has been sent to your bank account. Ref: ${reference}`,
          });
        }
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

      if (payoutRiderId && !alreadyReleased) {
        await sendReceipt({
          userId: payoutRiderId,
          riderId: payoutRiderId,
          title: event.event === 'transfer.reversed' ? 'Payout reversed' : 'Payout failed',
          message: `Your payout of ${fmtNaira(payoutKobo / 100)} could not be completed. Your earnings have been returned to your available balance.`,
        });
      }
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

      if (String((withdrawal as { status?: string }).status ?? '') !== 'transfer_success') {
        await sendReceipt({
          userId: (withdrawal as { user_id: string }).user_id,
          title: 'Withdrawal successful',
          message: `${fmtNaira(Number((withdrawal as { amount: number }).amount))} has been sent to your bank account. Ref: ${reference}`,
        });
      }
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

    if (!alreadyRefunded) {
      await sendReceipt({
        userId: (withdrawal as { user_id: string }).user_id,
        title: event.event === 'transfer.reversed' ? 'Withdrawal reversed' : 'Withdrawal failed',
        message: `Your withdrawal of ${fmtNaira(Number((withdrawal as { amount: number }).amount))} could not be completed. The amount has been refunded to your wallet.`,
      });
    }
    return ok({ received: true, type: event.event });
  }

  if (event.event !== 'charge.success') {
    return ok();
  }

  const data = event.data as {
    reference?: string;
    amount?: number;
    status?: string;
    authorization?: {
      authorization_code?: string;
      last4?: string;
      exp_month?: string;
      exp_year?: string;
      brand?: string;
    };
    metadata?: Record<string, string>;
  } | undefined;

  if (!data?.reference) {
    console.error('paystack-webhook: missing reference in event.data');
    return ok();
  }

  // --- Bank-transfer settlement (central collection account) ---
  // A pending payments row keyed by provider reference means this charge belongs
  // to the transfer flow from payment-init. Settle it: re-verify with Paystack,
  // require the EXACT expected amount, then mark paid + ledger + dispatch.
  // Wrong amounts go to the exception path — never dispatch, never reassign.
  // Card charges have no payments row and fall through to the card path below.
  {
    const { data: pendingPayment } = await supabase
      .from('payments')
      .select('id, reference, delivery_id, customer_id, expected_amount_kobo, status')
      .eq('provider_transaction_id', data.reference)
      .eq('method', 'bank_transfer')
      .maybeSingle();

    if (pendingPayment) {
      const payment = pendingPayment as {
        id: string;
        reference: string;
        delivery_id: string;
        customer_id: string;
        expected_amount_kobo: number;
        status: string;
      };

      // Metadata cross-check: the event must carry our internal ref.
      const metaRef = data.metadata?.internal_ref;
      if (metaRef && metaRef !== payment.reference) {
        console.error('paystack-webhook: settlement metadata ref mismatch', {
          eventRef: data.reference,
          metaRef,
          expected: payment.reference,
        });
        return ok();
      }

      // Already settled (retry after a crash window)? Resume only if the
      // collection ledger row is missing; otherwise this is a duplicate.
      if (payment.status === 'successful') {
        const { data: ledgerHit } = await supabase
          .from('ledger_entries')
          .select('id')
          .eq('delivery_id', payment.delivery_id)
          .eq('type', 'collection')
          .limit(1);
        if (ledgerHit && ledgerHit.length > 0) {
          return ok({ received: true, duplicate: true });
        }
      }

      // Re-verify with Paystack before moving money state.
      let verifiedOk = false;
      let verifiedAmountKobo = 0;
      try {
        const verifyRes = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
          { headers: { Authorization: `Bearer ${secret}` } }
        );
        const verifyData = await verifyRes.json();
        verifiedOk = !!verifyData.status && verifyData.data?.status === 'success';
        verifiedAmountKobo = Number(verifyData.data?.amount) || 0;
      } catch (e) {
        console.error('paystack-webhook: settlement re-verify failed', e);
      }
      if (!verifiedOk) {
        // Leave pending — a later event delivery settles it.
        console.error('paystack-webhook: transfer not verified successful', data.reference);
        return ok();
      }

      if (verifiedAmountKobo !== payment.expected_amount_kobo) {
        const now = new Date().toISOString();
        await supabase
          .from('payments')
          .update({
            status: 'failed',
            failure_reason: `Amount mismatch: expected ${payment.expected_amount_kobo} kobo, received ${verifiedAmountKobo} kobo`,
            updated_at: now,
          })
          .eq('id', payment.id);
        await supabase
          .from('deliveries')
          .update({ payment_status: 'failed' })
          .eq('id', payment.delivery_id);
        await sendReceipt({
          userId: payment.customer_id,
          title: 'Payment needs review',
          message: `We received ₦${(verifiedAmountKobo / 100).toFixed(2)} but booking ${payment.reference} requires ₦${(payment.expected_amount_kobo / 100).toFixed(2)}. Contact support — please do not pay again yet.`,
        });
        return ok({ received: true, type: 'charge.success', kind: 'transfer_amount_mismatch' });
      }

      const now = new Date().toISOString();
      await supabase
        .from('payments')
        .update({
          status: 'successful',
          confirmed_amount_kobo: verifiedAmountKobo,
          confirmed_at: now,
          failure_reason: null,
          updated_at: now,
        })
        .eq('id', payment.id);

      await supabase
        .from('deliveries')
        .update({ payment_status: 'paid', amount_paid: verifiedAmountKobo / 100 })
        .eq('id', payment.delivery_id);

      const { data: existingLedger } = await supabase
        .from('ledger_entries')
        .select('id')
        .eq('delivery_id', payment.delivery_id)
        .eq('type', 'collection')
        .limit(1);
      if (!existingLedger || existingLedger.length === 0) {
        await supabase.from('ledger_entries').insert({
          delivery_id: payment.delivery_id,
          amount_kobo: verifiedAmountKobo,
          type: 'collection',
          note: `bank_transfer settlement ref ${payment.reference}`,
        });
      }

      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('reference', payment.reference)
        .maybeSingle();
      if (!existingTx) {
        await supabase.from('transactions').insert({
          user_id: payment.customer_id,
          amount: verifiedAmountKobo / 100,
          type: 'debit',
          category: 'booking_charge',
          provider: 'paystack',
          provider_reference: data.reference,
          metadata: {
            paystack_event: event.event,
            intent: 'booking',
            method: 'bank_transfer',
            internal_ref: payment.reference,
          },
          reference: payment.reference,
          status: 'success',
        });
      }

      // Dispatch to riders (shared with the create-delivery card path) — but
      // only if the delivery is still open. Late money for a cancelled/expired
      // booking is still recorded (payments + ledger above) yet never dispatched;
      // the customer is routed to support for a refund/rebook.
      const { data: deliveryRow } = await supabase
        .from('deliveries')
        .select('id, user_id, pickup_address, pickup_lat, pickup_lng, status')
        .eq('id', payment.delivery_id)
        .maybeSingle();
      let dispatched = false;
      if (deliveryRow) {
        const d = deliveryRow as {
          id: string;
          user_id: string;
          pickup_address: string;
          pickup_lat: number;
          pickup_lng: number;
          status: string;
        };
        if (d.status === 'pending') {
          await notifyRidersForDelivery({
            admin: supabase,
            supabaseUrl,
            serviceRoleKey,
            deliveryId: d.id,
            customerId: d.user_id,
            pickupLat: Number(d.pickup_lat),
            pickupLng: Number(d.pickup_lng),
            pickupAddress: d.pickup_address,
          });
          dispatched = true;
        }
      }

      await sendReceipt({
        userId: payment.customer_id,
        title: 'Payment successful',
        message: dispatched
          ? `Your bank transfer of ₦${(verifiedAmountKobo / 100).toFixed(2)} for your delivery was confirmed. Ref: ${payment.reference}`
          : `Your bank transfer of ₦${(verifiedAmountKobo / 100).toFixed(2)} arrived after booking ${payment.reference} was closed. Contact support for a refund or rebook — do not pay again.`,
      });
      return ok({ received: true, type: 'charge.success', kind: 'transfer_settlement' });
    }
  }

  if (!data?.authorization?.authorization_code) {
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

  // Receipt for the customer. Skip bare card authorizations (add-card flow).
  if (intent === 'fund_wallet') {
    await sendReceipt({
      userId,
      title: 'Wallet top-up successful',
      message: `Your wallet has been credited with ${fmtNaira(amountNaira)}. Ref: ${data.reference}`,
    });
  } else if (intent === 'booking') {
    await sendReceipt({
      userId,
      title: 'Payment successful',
      message: `Your card payment of ${fmtNaira(amountNaira)} for your delivery was successful. Ref: ${data.reference}`,
    });
  }

  return ok();
});

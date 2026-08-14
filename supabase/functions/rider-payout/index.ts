// Pays out rider earnings to bank via Paystack. Requires 4-digit withdrawal PIN.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { pinFailurePayload } from '../_shared/pinError.ts';

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

const MIN_NAIRA = 50;
const IDEMPOTENCY_KEY_REGEX = /^[a-zA-Z0-9_-]{8,120}$/;
const STATUS = {
  initiated: 'initiated',
  transferPending: 'transfer_pending',
  transferSuccess: 'transfer_success',
  transferFailedReleased: 'transfer_failed_released',
  failed: 'failed',
} as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')?.trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!secret || !supabaseUrl || !serviceRoleKey || !anonKey) {
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
  const riderId = authData.user.id;

  const { data: riderRow } = await authClient
    .from('riders')
    .select('id')
    .eq('id', riderId)
    .maybeSingle();
  if (!riderRow) {
    return json({ error: 'Rider account required' }, 403);
  }

  let body: {
    account_number?: string;
    bank_code?: string;
    idempotency_key?: string;
    withdrawal_pin?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const accountNumber = String(body.account_number ?? '').trim();
  const bankCode = String(body.bank_code ?? '').trim();
  const idempotencyKey = String(body.idempotency_key ?? '').trim();
  const withdrawalPin = String(body.withdrawal_pin ?? '').trim();

  if (!/^\d{10}$/.test(accountNumber)) {
    return json({ error: 'Enter a valid 10-digit account number' }, 400);
  }
  if (!bankCode) {
    return json({ error: 'Select a bank' }, 400);
  }
  if (idempotencyKey && !IDEMPOTENCY_KEY_REGEX.test(idempotencyKey)) {
    return json({ error: 'Invalid idempotency key format' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const paystackHeaders = {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json',
  };

  const reference = idempotencyKey
    ? `rp_${riderId}_${idempotencyKey}`
    : `rp_${riderId}_${Date.now()}`;

  if (idempotencyKey) {
    const { data: existing } = await admin
      .from('rider_payout_requests')
      .select('amount, bank_code, account_number, account_name, status, failure_reason')
      .eq('reference', reference)
      .maybeSingle();

    if (existing) {
      const samePayload =
        (existing as { bank_code: string }).bank_code === bankCode &&
        (existing as { account_number: string }).account_number === accountNumber;
      if (!samePayload) {
        return json({ error: 'This idempotency key was used with different payout details' }, 409);
      }
      const existingStatus = String((existing as { status?: string }).status ?? STATUS.initiated);
      if (
        existingStatus === STATUS.initiated ||
        existingStatus === STATUS.transferPending ||
        existingStatus === STATUS.transferSuccess
      ) {
        return json({
          success: true,
          amount: Number((existing as { amount: number }).amount),
          account_name: (existing as { account_name?: string | null }).account_name ?? null,
          status: existingStatus,
          message: `Payout already ${existingStatus}.`,
          reference,
          idempotent: true,
        });
      }
      return json(
        {
          success: false,
          error: (existing as { failure_reason?: string | null }).failure_reason ?? 'Previous payout failed',
          status: existingStatus,
          reference,
          idempotent: true,
        },
        409
      );
    }
  }

  const { data: pinCheck, error: pinCheckError } = await admin.rpc('verify_withdrawal_pin', {
    p_user_id: riderId,
    p_pin: withdrawalPin,
  });
  if (pinCheckError) {
    return json({ error: 'Could not verify withdrawal PIN' }, 500);
  }
  const pinResult = pinCheck as {
    valid?: boolean;
    error?: string;
    locked?: boolean;
    attempts_left?: number;
    locked_until?: string | null;
  };
  if (!pinResult?.valid) {
    return json(pinFailurePayload(pinResult), pinResult?.locked ? 429 : 403);
  }

  const { data: reserveData, error: reserveError } = await admin.rpc('reserve_rider_earnings', {
    p_rider_id: riderId,
  });
  if (reserveError) {
    console.error('rider-payout reserve error', reserveError);
    return json({ error: 'Could not reserve earnings' }, 500);
  }
  const reserve = reserveData as {
    success?: boolean;
    amount?: number;
    earning_ids?: string[];
    error?: string;
  };
  if (!reserve?.success) {
    return json({ error: reserve?.error ?? 'No earnings available for payout' }, 400);
  }

  const amount = Number(reserve.amount);
  const earningIds = (reserve.earning_ids ?? []) as string[];
  if (!Number.isFinite(amount) || amount < MIN_NAIRA) {
    await admin.rpc('release_rider_earnings', { p_earning_ids: earningIds });
    return json({ error: `Minimum payout is ₦${MIN_NAIRA}` }, 400);
  }

  const releaseOnFailure = async () => {
    await admin.rpc('release_rider_earnings', { p_earning_ids: earningIds });
  };

  const updatePayout = async (payload: Record<string, unknown>) => {
    const { error } = await admin.from('rider_payout_requests').update(payload).eq('reference', reference);
    if (error) {
      console.error('rider-payout: failed to update payout request', { reference, error });
    }
  };

  const { error: insertError } = await admin.from('rider_payout_requests').insert({
    rider_id: riderId,
    amount,
    bank_code: bankCode,
    account_number: accountNumber,
    reference,
    earning_ids: earningIds,
    status: STATUS.initiated,
  });
  if (insertError) {
    console.error('rider-payout: create request error', insertError);
    if (String((insertError as { code?: string }).code) === '23505') {
      const { data: existing } = await admin
        .from('rider_payout_requests')
        .select('amount, bank_code, account_number, account_name, status, failure_reason, earning_ids')
        .eq('reference', reference)
        .maybeSingle();
      const existingIds = ((existing as { earning_ids?: string[] } | null)?.earning_ids ?? []) as string[];
      const existingOwnsOurs =
        existingIds.length > 0 &&
        earningIds.every((id) => existingIds.includes(id));
      if (!existingOwnsOurs) {
        await releaseOnFailure();
      }
      if (existing) {
        const existingStatus = String((existing as { status?: string }).status ?? STATUS.initiated);
        if (
          existingStatus === STATUS.initiated ||
          existingStatus === STATUS.transferPending ||
          existingStatus === STATUS.transferSuccess
        ) {
          return json({
            success: true,
            amount: Number((existing as { amount: number }).amount),
            account_name: (existing as { account_name?: string | null }).account_name ?? null,
            status: existingStatus,
            message: `Payout already ${existingStatus}.`,
            reference,
            idempotent: true,
          });
        }
        return json(
          {
            success: false,
            error:
              (existing as { failure_reason?: string | null }).failure_reason ??
              'Previous payout failed for this idempotency key',
            status: existingStatus,
            reference,
            idempotent: true,
          },
          409
        );
      }
    }
    await releaseOnFailure();
    return json({ error: 'Could not start payout request' }, 500);
  }

  let accountName: string | null = null;
  try {
    const resolveRes = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      { headers: paystackHeaders }
    );
    const resolveData = await resolveRes.json();
    if (!resolveData.status) {
      await releaseOnFailure();
      await updatePayout({
        status: STATUS.failed,
        failure_reason: resolveData.message || 'Could not verify bank account',
        updated_at: new Date().toISOString(),
      });
      return json({ error: resolveData.message || 'Could not verify bank account' }, 400);
    }
    accountName = resolveData.data.account_name;
    await updatePayout({ account_name: accountName, updated_at: new Date().toISOString() });
  } catch {
    await releaseOnFailure();
    await updatePayout({
      status: STATUS.failed,
      failure_reason: 'Could not verify bank account',
      updated_at: new Date().toISOString(),
    });
    return json({ error: 'Could not verify bank account' }, 400);
  }

  let recipientCode: string;
  try {
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: paystackHeaders,
      body: JSON.stringify({
        type: 'nuban',
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: 'NGN',
      }),
    });
    const recipientData = await recipientRes.json();
    if (!recipientData.status) {
      await releaseOnFailure();
      await updatePayout({
        status: STATUS.failed,
        failure_reason: recipientData.message || 'Could not create transfer recipient',
        updated_at: new Date().toISOString(),
      });
      return json({ error: recipientData.message || 'Could not create transfer recipient' }, 400);
    }
    recipientCode = recipientData.data.recipient_code;
    await updatePayout({ recipient_code: recipientCode, updated_at: new Date().toISOString() });
  } catch {
    await releaseOnFailure();
    await updatePayout({
      status: STATUS.failed,
      failure_reason: 'Could not create transfer recipient',
      updated_at: new Date().toISOString(),
    });
    return json({ error: 'Could not create transfer recipient' }, 400);
  }

  let transferCode: string | null = null;
  let transferStatus: typeof STATUS.transferPending | typeof STATUS.transferSuccess =
    STATUS.transferPending;
  await updatePayout({ status: STATUS.transferPending, updated_at: new Date().toISOString() });

  try {
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: paystackHeaders,
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(amount * 100),
        recipient: recipientCode,
        reason: 'Ridely rider payout',
        reference,
      }),
    });
    const transferData = await transferRes.json();
    const transferMessage = String(transferData.message || '');
    const duplicateRef = /duplicate|already exists|already been used/i.test(transferMessage);
    if (!transferData.status) {
      if (duplicateRef) {
        await updatePayout({
          status: STATUS.transferPending,
          failure_reason: null,
          updated_at: new Date().toISOString(),
        });
        return json({
          success: true,
          amount,
          account_name: accountName,
          status: STATUS.transferPending,
          reference,
          message: `₦${amount.toLocaleString()} payout is already in progress.`,
        });
      }
      await releaseOnFailure();
      await updatePayout({
        status: STATUS.transferFailedReleased,
        failure_reason: transferMessage || 'Transfer failed. Earnings released.',
        updated_at: new Date().toISOString(),
      });
      return json({ error: transferMessage || 'Transfer failed. Your earnings were not paid out.' }, 400);
    }
    transferCode = transferData.data.transfer_code ?? null;
    transferStatus =
      transferData.data.status === 'success' ? STATUS.transferSuccess : STATUS.transferPending;
    await updatePayout({
      transfer_code: transferCode,
      status: transferStatus,
      failure_reason: null,
      updated_at: new Date().toISOString(),
    });
  } catch (transferErr) {
    // Network/timeout after Paystack may have queued the transfer. Keep earnings
    // reserved and let the webhook mark success or release on failure.
    console.error('rider-payout: transfer request uncertain', transferErr);
    await updatePayout({
      status: STATUS.transferPending,
      failure_reason: 'Transfer status uncertain; waiting for Paystack webhook',
      updated_at: new Date().toISOString(),
    });
    return json({
      success: true,
      amount,
      account_name: accountName,
      status: STATUS.transferPending,
      reference,
      message: `₦${amount.toLocaleString()} payout is being processed. You will be notified when it completes.`,
    });
  }

  return json({
    success: true,
    amount,
    account_name: accountName,
    status: transferStatus,
    reference,
    message: `₦${amount.toLocaleString()} is on its way to ${accountName}.`,
  });
});

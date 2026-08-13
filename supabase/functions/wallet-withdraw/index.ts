// Withdraws from a user's wallet to their bank account via Paystack Transfers.
// Flow: authenticate user -> resolve account -> create transfer recipient ->
// atomically debit wallet -> initiate transfer (refund on failure) ->
// record debit transaction + withdrawal_requests row.

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

const MIN_NAIRA = 100;
const IDEMPOTENCY_KEY_REGEX = /^[a-zA-Z0-9_-]{8,120}$/;
const DEFAULT_MAX_WITHDRAWAL_NAIRA = 200_000;
const DEFAULT_DAILY_WITHDRAWAL_LIMIT_NAIRA = 500_000;
const DEFAULT_DAILY_WITHDRAWAL_COUNT_LIMIT = 5;
const DEFAULT_MIN_ACCOUNT_AGE_HOURS = 24;
const STATUS = {
  initiated: 'initiated',
  debited: 'debited',
  transferPending: 'transfer_pending',
  transferSuccess: 'transfer_success',
  transferFailedRefunded: 'transfer_failed_refunded',
  failed: 'failed',
} as const;

function envNumber(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

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
  const userId = authData.user.id;

  let body: {
    amount?: number;
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

  const amount = Number(body.amount);
  const accountNumber = String(body.account_number ?? '').trim();
  const bankCode = String(body.bank_code ?? '').trim();
  const idempotencyKey = String(body.idempotency_key ?? '').trim();
  const withdrawalPin = String(body.withdrawal_pin ?? '').trim();

  if (!Number.isFinite(amount) || amount < MIN_NAIRA) {
    return json({ error: `Minimum withdrawal is ₦${MIN_NAIRA}` }, 400);
  }
  if (!/^\d{10}$/.test(accountNumber)) {
    return json({ error: 'Enter a valid 10-digit account number' }, 400);
  }
  if (!bankCode) {
    return json({ error: 'Select a bank' }, 400);
  }
  if (idempotencyKey && !IDEMPOTENCY_KEY_REGEX.test(idempotencyKey)) {
    return json({ error: 'Invalid idempotency key format' }, 400);
  }

  const maxWithdrawalPerTx = envNumber('WITHDRAW_MAX_PER_TX_NAIRA', DEFAULT_MAX_WITHDRAWAL_NAIRA);
  const dailyWithdrawalLimit = envNumber(
    'WITHDRAW_DAILY_LIMIT_NAIRA',
    DEFAULT_DAILY_WITHDRAWAL_LIMIT_NAIRA
  );
  const dailyWithdrawalCountLimit = Math.max(
    1,
    Math.floor(envNumber('WITHDRAW_DAILY_COUNT_LIMIT', DEFAULT_DAILY_WITHDRAWAL_COUNT_LIMIT))
  );
  const minAccountAgeHours = envNumber('WITHDRAW_MIN_ACCOUNT_AGE_HOURS', DEFAULT_MIN_ACCOUNT_AGE_HOURS);

  if (amount > maxWithdrawalPerTx) {
    return json(
      { error: `Maximum single withdrawal is ₦${maxWithdrawalPerTx.toLocaleString('en-NG')}` },
      400
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const paystackHeaders = {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json',
  };

  const reference = idempotencyKey
    ? `wd_${userId}_${idempotencyKey}`
    : `wd_${userId}_${Date.now()}`;

  const updateWithdrawal = async (payload: Record<string, unknown>) => {
    const { error } = await admin.from('withdrawal_requests').update(payload).eq('reference', reference);
    if (error) {
      console.error('wallet-withdraw: failed to update withdrawal request', { reference, error });
    }
  };

  // If caller retries with the same idempotency key, return the prior outcome.
  if (idempotencyKey) {
    const { data: existing } = await admin
      .from('withdrawal_requests')
      .select('amount, bank_code, account_number, account_name, status, failure_reason')
      .eq('reference', reference)
      .maybeSingle();

    if (existing) {
      const samePayload =
        Number((existing as { amount: number }).amount) === amount &&
        (existing as { bank_code: string }).bank_code === bankCode &&
        (existing as { account_number: string }).account_number === accountNumber;
      if (!samePayload) {
        return json(
          { error: 'This idempotency key was used with different withdrawal details' },
          409
        );
      }

      const existingStatus = String((existing as { status?: string }).status ?? STATUS.initiated);
      if (
        existingStatus === STATUS.initiated ||
        existingStatus === STATUS.debited ||
        existingStatus === STATUS.transferPending ||
        existingStatus === STATUS.transferSuccess
      ) {
        return json({
          success: true,
          amount,
          account_name: (existing as { account_name?: string | null }).account_name ?? null,
          status: existingStatus,
          message: `₦${amount.toLocaleString()} withdrawal already ${existingStatus}.`,
          reference,
          idempotent: true,
        });
      }

      return json(
        {
          success: false,
          error:
            (existing as { failure_reason?: string | null }).failure_reason ??
            'Previous withdrawal attempt failed for this idempotency key',
          status: existingStatus,
          reference,
          idempotent: true,
        },
        409
      );
    }
  }

  const { data: pinCheck, error: pinCheckError } = await admin.rpc('verify_withdrawal_pin', {
    p_user_id: userId,
    p_pin: withdrawalPin,
  });
  if (pinCheckError) {
    console.error('wallet-withdraw: pin verify error', pinCheckError);
    return json({ error: 'Could not verify withdrawal PIN' }, 500);
  }
  const pinResult = pinCheck as { valid?: boolean; error?: string; locked?: boolean };
  if (!pinResult?.valid) {
    return json(
      {
        error: pinResult?.error ?? 'Invalid withdrawal PIN',
        pin_locked: !!pinResult?.locked,
      },
      pinResult?.locked ? 429 : 403
    );
  }

  const { error: createRequestError } = await admin.from('withdrawal_requests').insert({
    user_id: userId,
    amount,
    bank_code: bankCode,
    account_number: accountNumber,
    reference,
    status: STATUS.initiated,
  });
  if (createRequestError) {
    console.error('wallet-withdraw: create request error', createRequestError);
    // If another request already created this reference, treat it as idempotent collision.
    if (idempotencyKey) {
      return json({ error: 'Withdrawal already initiated for this idempotency key' }, 409);
    }
    return json({ error: 'Could not start withdrawal request' }, 500);
  }

  // Basic risk guard: hold withdrawals for very new accounts.
  const { data: userProfile } = await admin
    .from('users')
    .select('created_at')
    .eq('id', userId)
    .maybeSingle();
  const userCreatedAt = (userProfile as { created_at?: string | null } | null)?.created_at;
  if (userCreatedAt) {
    const createdMs = new Date(userCreatedAt).getTime();
    const ageHours = (Date.now() - createdMs) / (1000 * 60 * 60);
    if (Number.isFinite(ageHours) && ageHours < minAccountAgeHours) {
      await updateWithdrawal({
        status: STATUS.failed,
        failure_reason: `Account too new for withdrawal (< ${minAccountAgeHours}h hold)`,
        updated_at: new Date().toISOString(),
      });
      return json(
        {
          error:
            'Withdrawals are temporarily locked for new accounts. Please try again later or contact support.',
        },
        403
      );
    }
  }

  // Velocity controls: per-day count and amount.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { data: todaysWithdrawals, error: dailyError } = await admin
    .from('withdrawal_requests')
    .select('amount')
    .eq('user_id', userId)
    .gte('created_at', todayStart.toISOString())
    .in('status', [
      STATUS.initiated,
      STATUS.debited,
      STATUS.transferPending,
      STATUS.transferSuccess,
      STATUS.transferFailedRefunded,
      'transfer_reversed_refunded',
    ]);
  if (dailyError) {
    console.error('wallet-withdraw: daily velocity query failed', dailyError);
  } else {
    const todaysCount = (todaysWithdrawals ?? []).length;
    const todaysTotal = (todaysWithdrawals ?? []).reduce(
      (sum, row) => sum + Number((row as { amount?: number }).amount ?? 0),
      0
    );
    if (todaysCount >= dailyWithdrawalCountLimit) {
      await updateWithdrawal({
        status: STATUS.failed,
        failure_reason: 'Daily withdrawal count limit reached',
        updated_at: new Date().toISOString(),
      });
      return json({ error: 'Daily withdrawal limit reached. Try again tomorrow.' }, 429);
    }
    if (todaysTotal + amount > dailyWithdrawalLimit) {
      await updateWithdrawal({
        status: STATUS.failed,
        failure_reason: 'Daily withdrawal amount limit reached',
        updated_at: new Date().toISOString(),
      });
      return json(
        { error: `Daily withdrawal amount exceeded (₦${dailyWithdrawalLimit.toLocaleString('en-NG')})` },
        429
      );
    }
  }

  // Check current balance before starting
  const { data: wallet } = await admin
    .from('users_wallet')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle();
  const currentBalance = wallet ? Number((wallet as { balance: number }).balance) : 0;
  if (currentBalance < amount) {
    await updateWithdrawal({
      status: STATUS.failed,
      failure_reason: 'Insufficient wallet balance',
      updated_at: new Date().toISOString(),
    });
    return json({ error: 'Insufficient wallet balance' }, 400);
  }

  // 1. Resolve account name
  let accountName: string | null = null;
  try {
    const resolveRes = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      { headers: paystackHeaders }
    );
    const resolveData = await resolveRes.json();
    if (!resolveData.status) {
      await updateWithdrawal({
        status: STATUS.failed,
        failure_reason: resolveData.message || 'Could not verify bank account',
        updated_at: new Date().toISOString(),
      });
      return json({ error: resolveData.message || 'Could not verify bank account' }, 400);
    }
    accountName = resolveData.data.account_name;
    await updateWithdrawal({
      account_name: accountName,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    await updateWithdrawal({
      status: STATUS.failed,
      failure_reason: 'Could not verify bank account',
      updated_at: new Date().toISOString(),
    });
    return json({ error: 'Could not verify bank account' }, 400);
  }

  // 2. Create transfer recipient
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
      await updateWithdrawal({
        status: STATUS.failed,
        failure_reason: recipientData.message || 'Could not create transfer recipient',
        updated_at: new Date().toISOString(),
      });
      return json({ error: recipientData.message || 'Could not create transfer recipient' }, 400);
    }
    recipientCode = recipientData.data.recipient_code;
    await updateWithdrawal({
      recipient_code: recipientCode,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    await updateWithdrawal({
      status: STATUS.failed,
      failure_reason: 'Could not create transfer recipient',
      updated_at: new Date().toISOString(),
    });
    return json({ error: 'Could not create transfer recipient' }, 400);
  }

  // 3. Atomically debit the wallet (reserve funds) before initiating transfer
  const { data: debited, error: debitError } = await admin.rpc('debit_wallet', {
    p_user_id: userId,
    p_amount: amount,
  });
  if (debitError) {
    console.error('wallet-withdraw debit error', debitError);
    await updateWithdrawal({
      status: STATUS.failed,
      failure_reason: 'Failed to reserve funds',
      updated_at: new Date().toISOString(),
    });
    return json({ error: 'Failed to reserve funds' }, 500);
  }
  if (!debited) {
    await updateWithdrawal({
      status: STATUS.failed,
      failure_reason: 'Insufficient wallet balance',
      updated_at: new Date().toISOString(),
    });
    return json({ error: 'Insufficient wallet balance' }, 400);
  }
  await updateWithdrawal({
    status: STATUS.debited,
    updated_at: new Date().toISOString(),
  });

  // 4. Initiate the transfer; refund the wallet if it fails
  let transferCode: string | null = null;
  let transferStatus = STATUS.transferPending;
  await updateWithdrawal({
    status: STATUS.transferPending,
    updated_at: new Date().toISOString(),
  });
  try {
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: paystackHeaders,
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(amount * 100),
        recipient: recipientCode,
        reason: 'Ridely wallet withdrawal',
        reference,
      }),
    });
    const transferData = await transferRes.json();
    if (!transferData.status) {
      await admin.rpc('credit_wallet', { p_user_id: userId, p_amount: amount });
      await updateWithdrawal({
        status: STATUS.transferFailedRefunded,
        failure_reason: transferData.message || 'Transfer failed. Wallet refunded.',
        updated_at: new Date().toISOString(),
      });
      return json({ error: transferData.message || 'Transfer failed. Your wallet was not charged.' }, 400);
    }
    transferCode = transferData.data.transfer_code ?? null;
    transferStatus =
      transferData.data.status === 'success' ? STATUS.transferSuccess : STATUS.transferPending;
    await updateWithdrawal({
      transfer_code: transferCode,
      status: transferStatus,
      failure_reason: null,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    await admin.rpc('credit_wallet', { p_user_id: userId, p_amount: amount });
    await updateWithdrawal({
      status: STATUS.transferFailedRefunded,
      failure_reason: 'Transfer failed. Wallet refunded.',
      updated_at: new Date().toISOString(),
    });
    return json({ error: 'Transfer failed. Your wallet was not charged.' }, 400);
  }

  // 5. Record the debit transaction and withdrawal request (best-effort)
  await admin.from('transactions').insert({
    user_id: userId,
    amount,
    type: 'debit',
    category: 'wallet_withdrawal',
    provider: 'paystack',
    provider_reference: transferCode ?? reference,
    metadata: {
      withdrawal_reference: reference,
      transfer_code: transferCode,
      recipient_code: recipientCode,
      bank_code: bankCode,
      account_number_last4: accountNumber.slice(-4),
    },
    reference,
    status: transferStatus === STATUS.transferSuccess ? 'success' : 'pending',
  });

  await admin.from('withdrawal_requests').update({
    account_name: accountName,
    recipient_code: recipientCode,
    transfer_code: transferCode,
    status: transferStatus,
    updated_at: new Date().toISOString(),
  }).eq('reference', reference);

  return json({
    success: true,
    amount,
    account_name: accountName,
    status: transferStatus,
    reference,
    message: `₦${amount.toLocaleString()} is on its way to ${accountName}.`,
  });
});

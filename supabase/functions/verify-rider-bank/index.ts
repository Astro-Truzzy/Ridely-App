// Verifies a rider's bank destination for scheduled payouts (Phase 5).
// Authenticated rider flow: withdrawal PIN -> Paystack account resolve ->
// transfer recipient -> upsert verified rider_banks row. The settlement engine
// only pays rows with verified_at + recipient_code set, and pending payouts
// never reroute to a newly-added destination.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { pinFailurePayload } from '../_shared/pinError.ts';
import { createTransferRecipient, resolveAccountName } from '../_shared/transfers.ts';

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

  let body: { account_number?: string; bank_code?: string; withdrawal_pin?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const accountNumber = String(body.account_number ?? '').trim();
  const bankCode = String(body.bank_code ?? '').trim();
  const withdrawalPin = String(body.withdrawal_pin ?? '').trim();
  if (!/^\d{10}$/.test(accountNumber)) {
    return json({ error: 'Enter a valid 10-digit account number' }, 400);
  }
  if (!bankCode) {
    return json({ error: 'Select a bank' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: pinCheck, error: pinCheckError } = await admin.rpc('verify_withdrawal_pin', {
    p_user_id: riderId,
    p_pin: withdrawalPin,
  });
  if (pinCheckError) {
    return json({ error: 'Could not verify withdrawal PIN' }, 500);
  }
  const pinResult = pinCheck as {
    valid?: boolean;
    locked?: boolean;
    attempts_left?: number;
    locked_until?: string | null;
  };
  if (!pinResult?.valid) {
    return json(pinFailurePayload(pinResult), pinResult?.locked ? 429 : 403);
  }

  const resolved = await resolveAccountName(secret, accountNumber, bankCode);
  if (!resolved.ok || !resolved.accountName) {
    return json({ error: resolved.message || 'Could not verify bank account' }, 400);
  }

  const recipient = await createTransferRecipient(secret, {
    name: resolved.accountName,
    accountNumber,
    bankCode,
  });
  if (!recipient.ok || !recipient.recipientCode) {
    return json({ error: recipient.message || 'Could not create transfer recipient' }, 400);
  }

  const now = new Date().toISOString();
  const { error: upsertError } = await admin.from('rider_banks').upsert(
    {
      rider_id: riderId,
      account_number: accountNumber,
      bank_code: bankCode,
      account_name: resolved.accountName,
      recipient_code: recipient.recipientCode,
      verified_at: now,
      updated_at: now,
    },
    { onConflict: 'rider_id,account_number,bank_code' }
  );
  if (upsertError) {
    console.error('verify-rider-bank upsert error', upsertError);
    return json({ error: 'Could not save bank details' }, 500);
  }

  return json({
    success: true,
    account_name: resolved.accountName,
    message: `${resolved.accountName} verified for automatic payouts.`,
  });
});

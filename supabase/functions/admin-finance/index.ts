// Admin financial overview + batch detail (Phase 6). READ-ONLY.
// Auth: caller must be an authenticated user whose users.is_admin is true
// (checked server-side here, never trusted from the client). All aggregates
// come from the ledger (source of truth), never from display balances.
//
// Deliberately no mutating actions: failed payouts release automatically for
// the next scheduled run, and stuck transfer_pending rows must only be settled
// by the verified Paystack webhook — a manual "retry" button could double-pay.
// Use settlement-run?dry_run=true for safe inspection.

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
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Server misconfiguration' }, 500);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: userRow } = await admin
    .from('users')
    .select('is_admin')
    .eq('id', authData.user.id)
    .maybeSingle();
  if ((userRow as { is_admin?: boolean } | null)?.is_admin !== true) {
    return json({ error: 'Forbidden: admin access required' }, 403);
  }

  let action = 'overview';
  let batchId: string | null = null;
  if (req.method === 'POST') {
    try {
      const body = (await req.json()) as { action?: string; batch_id?: string };
      if (body.action) action = body.action;
      if (body.batch_id) batchId = body.batch_id;
    } catch {
      // fall through with defaults
    }
  } else {
    const url = new URL(req.url);
    if (url.searchParams.get('action')) action = url.searchParams.get('action') as string;
    if (url.searchParams.get('batch_id')) batchId = url.searchParams.get('batch_id');
  }

  if (action === 'batch') {
    if (!batchId) return json({ error: 'batch_id required' }, 400);
    const { data: batch } = await admin
      .from('payout_batches')
      .select('*')
      .eq('id', batchId)
      .maybeSingle();
    if (!batch) return json({ error: 'Batch not found' }, 404);
    const { data: payouts } = await admin
      .from('rider_payout_requests')
      .select('id, rider_id, amount, amount_kobo, status, failure_reason, reference, transfer_code, created_at, updated_at')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true });
    return json({ batch, payouts: payouts ?? [] });
  }

  if (action !== 'overview') {
    return json({ error: 'Unknown action' }, 400);
  }

  // Ledger aggregates by type (kobo, signed per the ledger convention).
  const { data: ledgerRows } = await admin
    .from('ledger_entries')
    .select('type, amount_kobo');
  const totals: Record<string, number> = {};
  for (const row of ((ledgerRows ?? []) as { type: string; amount_kobo: number }[])) {
    totals[row.type] = (totals[row.type] ?? 0) + Number(row.amount_kobo);
  }

  // Payment counts by status.
  const { data: paymentRows } = await admin
    .from('payments')
    .select('status, method, expected_amount_kobo');
  const paymentsByStatus: Record<string, { count: number; kobo: number }> = {};
  for (const p of ((paymentRows ?? []) as { status: string; method: string; expected_amount_kobo: number }[])) {
    const entry = paymentsByStatus[p.status] ?? { count: 0, kobo: 0 };
    entry.count += 1;
    entry.kobo += Number(p.expected_amount_kobo);
    paymentsByStatus[p.status] = entry;
  }

  // Recent settlement batches.
  const { data: batches } = await admin
    .from('payout_batches')
    .select('id, slot, lagos_business_date, status, eligible_rider_count, total_amount_kobo, paid_amount_kobo, failed_amount_kobo, scheduled_at, completed_at')
    .order('scheduled_at', { ascending: false })
    .limit(20);

  // Unmatched / needs-attention items.
  const { data: stuckPayments } = await admin
    .from('payments')
    .select('reference, status, method, expected_amount_kobo, failure_reason, created_at')
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: false })
    .limit(50);
  const { data: stuckPayouts } = await admin
    .from('rider_payout_requests')
    .select('reference, rider_id, amount, status, failure_reason, batch_id, created_at, updated_at')
    .in('status', ['initiated', 'transfer_pending', 'transfer_failed_released', 'failed'])
    .order('updated_at', { ascending: false })
    .limit(50);

  return json({
    ledger_totals_kobo: totals,
    payments_by_status: paymentsByStatus,
    batches: batches ?? [],
    attention: {
      payments: stuckPayments ?? [],
      payouts: stuckPayouts ?? [],
    },
  });
});

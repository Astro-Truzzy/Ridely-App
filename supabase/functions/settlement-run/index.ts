// Twice-daily automatic rider payout engine (Phase 5).
// Triggered by pg_cron + pg_net at 23:00 and 17:00 UTC (= 00:00 and 18:00
// Africa/Lagos; schedule lives in supabase/scheduler/payout_settlement.sql).
// These runs are settlement CUTOFFS that initiate/track transfers — bank-credit
// timing depends on Paystack/banks.
//
// Auth: x-cron-secret header must match SETTLEMENT_CRON_SECRET. Supports
// ?dry_run=true (same secret): computes the payout plan without writing
// anything or touching Paystack.
//
// Guarantees:
// - One batch per (Lagos date, slot) via the idempotency key; retried scheduler
//   runs resume or return the finished batch, never double-pay.
// - Earnings are claimed atomically per rider (claim_earnings_for_batch only
//   reserves still-unclaimed rows); concurrent workers cannot double-claim.
// - Per-rider payout references are deterministic: a rerun finds the existing
//   payout row instead of creating a second transfer.
// - transfer_pending payouts are NEVER blind-resubmitted; the webhook settles
//   them. Definitively failed transfers release earnings for the next run.
// - Success is marked only on provider confirmation (immediate 'success' or
//   the transfer.success webhook).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { initiatePaystackTransfer } from '../_shared/transfers.ts';
import {
  MIN_PAYOUT_KOBO,
  batchIdempotencyKey,
  lagosSlotFor,
  payoutReference,
} from '../_shared/settlement.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const STATUS = {
  initiated: 'initiated',
  transferPending: 'transfer_pending',
  transferSuccess: 'transfer_success',
  transferFailedReleased: 'transfer_failed_released',
  failed: 'failed',
} as const;

function json(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

type EligibleEarning = {
  earning_id: string;
  rider_id: string;
  net_kobo: number;
  delivery_id: string;
};

type VerifiedBank = {
  rider_id: string;
  account_number: string;
  bank_code: string;
  account_name: string | null;
  recipient_code: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get('SETTLEMENT_CRON_SECRET')?.trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY')?.trim();
  if (!cronSecret || !supabaseUrl || !serviceRoleKey || !paystackSecret) {
    return json({ error: 'Server misconfiguration' }, 500);
  }
  if (req.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'Forbidden' }, 403);
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry_run') === 'true';
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { lagosDate, slot } = lagosSlotFor(new Date());
  const idempotencyKey = batchIdempotencyKey(lagosDate, slot);

  // ---- 1. Eligibility snapshot ----
  const { data: eligibleRaw, error: eligibleError } = await admin.rpc(
    'settlement_eligible_earnings'
  );
  if (eligibleError) {
    console.error('settlement-run eligibility error', eligibleError);
    return json({ error: 'Could not load eligible earnings' }, 500);
  }
  const eligible = ((eligibleRaw ?? []) as EligibleEarning[]).filter(
    (e) => Number.isFinite(e.net_kobo) && e.net_kobo > 0
  );

  // Group per rider.
  const byRider = new Map<string, EligibleEarning[]>();
  for (const e of eligible) {
    const list = byRider.get(e.rider_id) ?? [];
    list.push(e);
    byRider.set(e.rider_id, list);
  }

  // Verified payout destinations for candidate riders.
  const riderIds = [...byRider.keys()];
  const banksByRider = new Map<string, VerifiedBank>();
  if (riderIds.length > 0) {
    const { data: banks } = await admin
      .from('rider_banks')
      .select('rider_id, account_number, bank_code, account_name, recipient_code')
      .in('rider_id', riderIds)
      .not('verified_at', 'is', null)
      .not('recipient_code', 'is', null)
      .order('verified_at', { ascending: false });
    for (const b of ((banks ?? []) as VerifiedBank[])) {
      if (!banksByRider.has(b.rider_id)) banksByRider.set(b.rider_id, b);
    }
  }

  const planned: { riderId: string; totalKobo: number; earningIds: string[]; bank: VerifiedBank }[] = [];
  const excluded: { riderId: string; reason: string; totalKobo: number }[] = [];
  for (const [riderId, rows] of byRider) {
    const totalKobo = rows.reduce((s, r) => s + r.net_kobo, 0);
    const bank = banksByRider.get(riderId);
    if (!bank) {
      excluded.push({ riderId, reason: 'no_verified_bank', totalKobo });
      continue;
    }
    if (totalKobo < MIN_PAYOUT_KOBO) {
      excluded.push({ riderId, reason: 'below_minimum', totalKobo });
      continue;
    }
    planned.push({
      riderId,
      totalKobo,
      earningIds: rows.map((r) => r.earning_id),
      bank,
    });
  }

  if (dryRun) {
    return json({
      dry_run: true,
      lagos_date: lagosDate,
      slot,
      idempotency_key: idempotencyKey,
      eligible_earnings: eligible.length,
      planned_riders: planned.length,
      planned_total_kobo: planned.reduce((s, p) => s + p.totalKobo, 0),
      planned,
      excluded,
    });
  }

  // ---- 2. Get-or-create batch ----
  const nowIso = new Date().toISOString();
  await admin.from('payout_batches').upsert(
    {
      slot,
      lagos_business_date: lagosDate,
      idempotency_key: idempotencyKey,
      status: 'open',
      scheduled_at: nowIso,
    },
    { onConflict: 'idempotency_key', ignoreDuplicates: true }
  );
  const { data: batchRow, error: batchError } = await admin
    .from('payout_batches')
    .select('id, status')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (batchError || !batchRow) {
    console.error('settlement-run batch error', batchError);
    return json({ error: 'Could not create settlement batch' }, 500);
  }
  const batch = batchRow as { id: string; status: string };
  if (batch.status === 'completed' || batch.status === 'partial') {
    return json({
      batch_id: batch.id,
      status: batch.status,
      idempotent: true,
      message: 'Batch already settled for this slot.',
    });
  }
  await admin
    .from('payout_batches')
    .update({ status: 'processing', started_at: nowIso })
    .eq('id', batch.id);

  // ---- 3. Recovery: release earnings linked to this batch that never got a
  // payout row (crash between claim and payout-row insert), so this run
  // re-selects them instead of stranding them. ----
  {
    const { data: linked } = await admin
      .from('earnings')
      .select('id')
      .eq('payout_batch_id', batch.id);
    const linkedIds = ((linked ?? []) as { id: string }[]).map((r) => r.id);
    if (linkedIds.length > 0) {
      const { data: existingPayouts } = await admin
        .from('rider_payout_requests')
        .select('earning_ids')
        .eq('batch_id', batch.id);
      const covered = new Set<string>();
      for (const p of ((existingPayouts ?? []) as { earning_ids: string[] }[])) {
        for (const id of p.earning_ids ?? []) covered.add(id);
      }
      const orphaned = linkedIds.filter((id) => !covered.has(id));
      if (orphaned.length > 0) {
        await admin.rpc('release_batch_earnings', {
          p_batch_id: batch.id,
          p_earning_ids: orphaned,
        });
        // Refresh eligibility snapshot for the re-released rows.
        const { data: refetch } = await admin.rpc('settlement_eligible_earnings');
        const fresh = ((refetch ?? []) as EligibleEarning[]).filter(
          (e) => Number.isFinite(e.net_kobo) && e.net_kobo > 0
        );
        eligible.length = 0;
        eligible.push(...fresh);
        byRider.clear();
        for (const e of eligible) {
          const list = byRider.get(e.rider_id) ?? [];
          list.push(e);
          byRider.set(e.rider_id, list);
        }
        planned.length = 0;
        excluded.length = 0;
        for (const [riderId, rows] of byRider) {
          const totalKobo = rows.reduce((s, r) => s + r.net_kobo, 0);
          const bank = banksByRider.get(riderId);
          if (!bank) {
            excluded.push({ riderId, reason: 'no_verified_bank', totalKobo });
            continue;
          }
          if (totalKobo < MIN_PAYOUT_KOBO) {
            excluded.push({ riderId, reason: 'below_minimum', totalKobo });
            continue;
          }
          planned.push({ riderId, totalKobo, earningIds: rows.map((r) => r.earning_id), bank });
        }
      }
    }
  }

  // ---- 4. Settle each rider ----
  let paidKobo = 0;
  let failedKobo = 0;
  let settledRiders = 0;
  const results: Record<string, unknown>[] = [];

  for (const plan of planned) {
    const reference = payoutReference(batch.id, plan.riderId);

    // Deterministic reference: a rerun finds this row, never duplicates it.
    const { data: existingPayout } = await admin
      .from('rider_payout_requests')
      .select('status')
      .eq('reference', reference)
      .maybeSingle();
    if (existingPayout) {
      results.push({
        rider_id: plan.riderId,
        reference,
        status: (existingPayout as { status: string }).status,
        idempotent: true,
      });
      continue;
    }

    // Atomic claim: only still-unclaimed rows are reserved.
    const { data: claimedRaw, error: claimError } = await admin.rpc(
      'claim_earnings_for_batch',
      { p_batch_id: batch.id, p_earning_ids: plan.earningIds }
    );
    if (claimError) {
      console.error('settlement-run claim error', plan.riderId, claimError);
      failedKobo += plan.totalKobo;
      results.push({ rider_id: plan.riderId, error: 'claim_failed' });
      continue;
    }
    const claimed = (claimedRaw ?? []) as { earning_id: string; rider_id: string; net_kobo: number }[];
    if (claimed.length === 0) {
      // Lost a race with another worker — earnings stay eligible elsewhere.
      results.push({ rider_id: plan.riderId, status: 'skipped_race' });
      continue;
    }
    const claimedIds = claimed.map((c) => c.earning_id);
    const claimedTotal = claimed.reduce((s, c) => s + Number(c.net_kobo), 0);
    if (claimedTotal < MIN_PAYOUT_KOBO) {
      await admin.rpc('release_batch_earnings', {
        p_batch_id: batch.id,
        p_earning_ids: claimedIds,
      });
      excluded.push({ riderId: plan.riderId, reason: 'below_minimum', totalKobo: claimedTotal });
      results.push({ rider_id: plan.riderId, status: 'below_minimum_released' });
      continue;
    }

    const { error: payoutRowError } = await admin.from('rider_payout_requests').insert({
      rider_id: plan.riderId,
      amount: claimedTotal / 100,
      amount_kobo: claimedTotal,
      bank_code: plan.bank.bank_code,
      account_number: plan.bank.account_number,
      account_name: plan.bank.account_name,
      recipient_code: plan.bank.recipient_code,
      reference,
      earning_ids: claimedIds,
      status: STATUS.initiated,
      batch_id: batch.id,
    });
    if (payoutRowError) {
      console.error('settlement-run payout row error', plan.riderId, payoutRowError);
      await admin.rpc('release_batch_earnings', {
        p_batch_id: batch.id,
        p_earning_ids: claimedIds,
      });
      failedKobo += claimedTotal;
      results.push({ rider_id: plan.riderId, error: 'payout_row_failed' });
      continue;
    }

    const setPayout = async (payload: Record<string, unknown>) => {
      const { error } = await admin
        .from('rider_payout_requests')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('reference', reference);
      if (error) console.error('settlement-run payout update failed', reference, error);
    };

    // Initiate the Paystack transfer. Uncertain (network/timeout) outcomes stay
    // reserved as transfer_pending for webhook reconciliation — never resubmitted.
    try {
      const tx = await initiatePaystackTransfer(paystackSecret, {
        amountKobo: claimedTotal,
        recipientCode: plan.bank.recipient_code as string,
        reason: 'Ridely rider payout',
        reference,
      });
      if (!tx.ok) {
        await admin.rpc('release_batch_earnings', {
          p_batch_id: batch.id,
          p_earning_ids: claimedIds,
        });
        await setPayout({
          status: STATUS.transferFailedReleased,
          failure_reason: tx.message || 'Transfer failed. Earnings released.',
        });
        failedKobo += claimedTotal;
        results.push({ rider_id: plan.riderId, reference, status: STATUS.transferFailedReleased });
        continue;
      }
      const transferStatus =
        tx.status === 'success' ? STATUS.transferSuccess : STATUS.transferPending;
      await setPayout({
        transfer_code: tx.transferCode,
        status: transferStatus,
        failure_reason: null,
      });
      if (transferStatus === STATUS.transferSuccess) {
        paidKobo += claimedTotal;
        settledRiders += 1;
      }
      results.push({ rider_id: plan.riderId, reference, status: transferStatus });
    } catch (e) {
      console.error('settlement-run transfer uncertain', plan.riderId, e);
      await setPayout({
        status: STATUS.transferPending,
        failure_reason: 'Transfer status uncertain; waiting for Paystack webhook',
      });
      results.push({ rider_id: plan.riderId, reference, status: STATUS.transferPending });
    }
  }

  // ---- 5. Finalize batch ----
  const totalKobo = planned.reduce((s, p) => s + p.totalKobo, 0);
  const hasPending = results.some(
    (r) => (r as { status?: string }).status === STATUS.transferPending
  );
  const batchStatus =
    failedKobo === 0 && !hasPending ? 'completed' : hasPending || paidKobo > 0 ? 'partial' : 'failed';
  const notesLines = [
    `slot ${slot} lagos ${lagosDate}`,
    `riders planned=${planned.length} settled_success=${settledRiders} excluded=${excluded.length}`,
  ];
  for (const x of excluded) {
    notesLines.push(`excluded ${x.riderId} reason=${x.reason} kobo=${x.totalKobo}`);
  }
  await admin
    .from('payout_batches')
    .update({
      status: batchStatus,
      eligible_rider_count: planned.length,
      total_amount_kobo: totalKobo,
      paid_amount_kobo: paidKobo,
      failed_amount_kobo: failedKobo,
      completed_at: new Date().toISOString(),
      notes: notesLines.join('\n'),
    })
    .eq('id', batch.id);

  return json({
    batch_id: batch.id,
    lagos_date: lagosDate,
    slot,
    status: batchStatus,
    planned_riders: planned.length,
    total_kobo: totalKobo,
    paid_kobo: paidKobo,
    failed_kobo: failedKobo,
    excluded,
    results,
  });
});

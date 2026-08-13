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

function parseNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toIsoDateTime(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

async function sumPaystackCharges(params: {
  secret: string;
  fromIso: string;
  toIso: string;
}): Promise<number> {
  let page = 1;
  let totalKobo = 0;
  for (;;) {
    const url =
      `https://api.paystack.co/transaction?status=success&perPage=100&page=${page}` +
      `&from=${encodeURIComponent(params.fromIso)}&to=${encodeURIComponent(params.toIso)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${params.secret}` },
    });
    const body = await res.json();
    if (!body?.status) {
      throw new Error(body?.message || 'Failed to fetch Paystack transactions');
    }

    const rows = Array.isArray(body.data) ? body.data : [];
    for (const row of rows) {
      totalKobo += parseNumber((row as { amount?: number }).amount);
    }

    const meta = (body.meta ?? {}) as { page?: number; pageCount?: number };
    const pageCount = parseNumber(meta.pageCount);
    if (rows.length === 0 || pageCount === 0 || page >= pageCount) break;
    page += 1;
  }
  return totalKobo / 100;
}

async function sumPaystackTransfers(params: {
  secret: string;
  fromIso: string;
  toIso: string;
}): Promise<number> {
  let page = 1;
  let totalKobo = 0;
  for (;;) {
    const url =
      `https://api.paystack.co/transfer?perPage=100&page=${page}` +
      `&from=${encodeURIComponent(params.fromIso)}&to=${encodeURIComponent(params.toIso)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${params.secret}` },
    });
    const body = await res.json();
    if (!body?.status) {
      throw new Error(body?.message || 'Failed to fetch Paystack transfers');
    }

    const rows = Array.isArray(body.data) ? body.data : [];
    for (const row of rows) {
      const status = String((row as { status?: string }).status ?? '').toLowerCase();
      if (status === 'success') {
        totalKobo += parseNumber((row as { amount?: number }).amount);
      }
    }

    const meta = (body.meta ?? {}) as { page?: number; pageCount?: number };
    const pageCount = parseNumber(meta.pageCount);
    if (rows.length === 0 || pageCount === 0 || page >= pageCount) break;
    page += 1;
  }
  return totalKobo / 100;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server misconfiguration' }, 500);
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return json({ error: 'Unauthorized. Use service role bearer token.' }, 401);
  }

  const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY')?.trim();
  if (!paystackSecret) return json({ error: 'PAYSTACK_SECRET_KEY not set' }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fromIso = toIsoDateTime(yesterday);
  const toIso = toIsoDateTime(now);

  const threshold = parseNumber(Deno.env.get('RECONCILIATION_DRIFT_THRESHOLD_NAIRA') ?? 100);
  const alertWebhookUrl = Deno.env.get('RECONCILIATION_ALERT_WEBHOOK_URL')?.trim() || '';

  try {
    const [
      liabilitiesRes,
      totalCreditRes,
      totalDebitRes,
      topupWindowRes,
      withdrawalWindowRes,
      paystackChargeWindow,
      paystackTransferWindow,
    ] = await Promise.all([
      admin.from('users_wallet').select('balance'),
      admin
        .from('transactions')
        .select('amount')
        .in('category', ['wallet_topup', 'promo_credit'])
        .eq('status', 'success'),
      admin
        .from('transactions')
        .select('amount')
        .eq('category', 'wallet_withdrawal')
        .eq('status', 'success'),
      admin
        .from('transactions')
        .select('amount')
        .eq('category', 'wallet_topup')
        .eq('status', 'success')
        .gte('created_at', fromIso)
        .lt('created_at', toIso),
      admin
        .from('transactions')
        .select('amount')
        .eq('category', 'wallet_withdrawal')
        .eq('status', 'success')
        .gte('created_at', fromIso)
        .lt('created_at', toIso),
      sumPaystackCharges({ secret: paystackSecret, fromIso, toIso }),
      sumPaystackTransfers({ secret: paystackSecret, fromIso, toIso }),
    ]);

    if (liabilitiesRes.error) throw liabilitiesRes.error;
    if (totalCreditRes.error) throw totalCreditRes.error;
    if (totalDebitRes.error) throw totalDebitRes.error;
    if (topupWindowRes.error) throw topupWindowRes.error;
    if (withdrawalWindowRes.error) throw withdrawalWindowRes.error;

    const liabilitiesTotal = (liabilitiesRes.data ?? []).reduce(
      (sum, row) => sum + parseNumber((row as { balance?: number }).balance),
      0
    );
    const internalSuccessCreditTotal = (totalCreditRes.data ?? []).reduce(
      (sum, row) => sum + parseNumber((row as { amount?: number }).amount),
      0
    );
    const internalSuccessDebitTotal = (totalDebitRes.data ?? []).reduce(
      (sum, row) => sum + parseNumber((row as { amount?: number }).amount),
      0
    );
    const internalTopupWindow = (topupWindowRes.data ?? []).reduce(
      (sum, row) => sum + parseNumber((row as { amount?: number }).amount),
      0
    );
    const internalWithdrawalWindow = (withdrawalWindowRes.data ?? []).reduce(
      (sum, row) => sum + parseNumber((row as { amount?: number }).amount),
      0
    );

    const topupDrift = internalTopupWindow - paystackChargeWindow;
    const withdrawalDrift = internalWithdrawalWindow - paystackTransferWindow;
    const ledgerDrift = liabilitiesTotal - (internalSuccessCreditTotal - internalSuccessDebitTotal);
    const maxAbsDrift = Math.max(
      Math.abs(topupDrift),
      Math.abs(withdrawalDrift),
      Math.abs(ledgerDrift)
    );
    const exceededThreshold = maxAbsDrift > threshold;

    let alertSent = false;
    const notes = exceededThreshold
      ? `Drift exceeded threshold ${threshold.toFixed(2)} NGN`
      : 'Within threshold';

    if (exceededThreshold && alertWebhookUrl) {
      try {
        const alertRes = await fetch(alertWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'wallet-reconciliation',
            project: 'ridely',
            window_start: fromIso,
            window_end: toIso,
            threshold,
            topup_drift: topupDrift,
            withdrawal_drift: withdrawalDrift,
            ledger_drift: ledgerDrift,
          }),
        });
        alertSent = alertRes.ok;
      } catch (e) {
        console.error('wallet-reconciliation: alert webhook failed', e);
      }
    }

    const { error: insertError } = await admin.from('wallet_reconciliation_runs').insert({
      window_start: fromIso,
      window_end: toIso,
      liabilities_total: liabilitiesTotal,
      internal_success_credit_total: internalSuccessCreditTotal,
      internal_success_debit_total: internalSuccessDebitTotal,
      internal_wallet_topup_window: internalTopupWindow,
      internal_withdrawal_window: internalWithdrawalWindow,
      paystack_charge_window: paystackChargeWindow,
      paystack_transfer_window: paystackTransferWindow,
      topup_drift: topupDrift,
      withdrawal_drift: withdrawalDrift,
      ledger_drift: ledgerDrift,
      threshold,
      exceeded_threshold: exceededThreshold,
      alert_sent: alertSent,
      notes,
    });
    if (insertError) throw insertError;

    return json({
      success: true,
      window_start: fromIso,
      window_end: toIso,
      threshold,
      exceeded_threshold: exceededThreshold,
      alert_sent: alertSent,
      metrics: {
        liabilities_total: liabilitiesTotal,
        internal_success_credit_total: internalSuccessCreditTotal,
        internal_success_debit_total: internalSuccessDebitTotal,
        internal_wallet_topup_window: internalTopupWindow,
        internal_withdrawal_window: internalWithdrawalWindow,
        paystack_charge_window: paystackChargeWindow,
        paystack_transfer_window: paystackTransferWindow,
        topup_drift: topupDrift,
        withdrawal_drift: withdrawalDrift,
        ledger_drift: ledgerDrift,
      },
    });
  } catch (e) {
    console.error('wallet-reconciliation', e);
    return json({ error: e instanceof Error ? e.message : 'Server error' }, 500);
  }
});

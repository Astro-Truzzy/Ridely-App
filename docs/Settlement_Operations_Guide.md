# Settlement Operations Guide (Phases 3 + 5)

Step-by-step process to implement the pg_cron schedule and the webhook
settlements. Companion to [Cashless_Rollout_Runbook.md](Cashless_Rollout_Runbook.md)
(which covers overall rollout) and
[Ridely_Payment_Implementation.md](Ridely_Payment_Implementation.md) (the spec).

Execute Part A first — the webhook settlement must work before scheduled
payouts mean anything — then Part B. Nothing here touches production without
explicit authorization.

---

## Part A — Phase 3 webhook settlement (transfer checkout → dispatch)

**What it does:** when a customer completes a bank transfer, Paystack fires
`charge.success` at the webhook. The settlement branch in
`supabase/functions/paystack-webhook/index.ts` matches the pending `payments`
row by provider reference, re-verifies with Paystack, requires the exact kobo
amount, then marks paid + writes the ledger + dispatches to riders.

### A1. Deploy the functions (staging project first)

```bash
npx supabase functions deploy paystack-webhook
npx supabase functions deploy payment-init
npx supabase functions deploy payment-status
npx supabase functions deploy create-delivery
```

### A2. Set secrets (Supabase Dashboard → Project Settings → Edge Functions → Secrets, or CLI)

```bash
npx supabase secrets set PAYSTACK_SECRET_KEY=sk_test_...
```

### A3. Register the webhook in Paystack (test mode)

1. Paystack Dashboard → Settings → API Keys & Webhooks → add webhook URL:
   `https://<PROJECT_REF>.supabase.co/functions/v1/paystack-webhook`
2. Subscribe to **`charge.success`** (and keep `transfer.success` /
   `transfer.failed` / `transfer.reversed` subscribed — those settle rider
   payouts in Phase 5).
3. Confirm the **`bank_transfer` checkout channel is enabled for NGN** — run one
   `payment-init` call from the app and check it returns instructions instead of
   erroring. If Paystack rejects it, stop here: nothing is persisted by design,
   and you'll see the provider message.

### A4. Walk a test transfer through, verifying each settlement step

1. In the app, choose **Bank transfer** → confirm the `payments` row is
   `pending` and the delivery is `pending` / `payment_status='pending'`:

   ```sql
   SELECT reference, status, expected_amount_kobo FROM payments
    ORDER BY created_at DESC LIMIT 1;
   -- expect: RDL-..., pending
   ```

2. Confirm the booking is **invisible to riders** (feed query returns nothing
   for it; direct `accept_delivery` RPC raises "Payment not verified").
3. Complete the transfer in the Paystack test channel. Then check settlement
   happened exactly once:

   ```sql
   -- payment settled
   SELECT status, confirmed_amount_kobo FROM payments WHERE reference='RDL-...';
   -- delivery paid and dispatched
   SELECT payment_status, status FROM deliveries WHERE id='<delivery_id>';
   -- exactly one collection ledger row, exact kobo
   SELECT COUNT(*), SUM(amount_kobo) FROM ledger_entries
    WHERE delivery_id='<delivery_id>' AND type='collection';
   ```

4. **Replay the webhook** (Paystack Dashboard → webhook → resend, or re-POST
   the event): counts above must not change — duplicates are absorbed.
5. **Wrong-amount test**: transfer an amount ≠ expected kobo → payment goes
   `failed`, delivery stays undispatched, customer gets the "needs review"
   receipt. Refund/rebook via support — never edit the rows by hand.
6. **Expiry test**: leave a transfer-pending booking 30+ min → auto-cancel marks
   delivery `cancelled_no_rider` + payment `expired`. If money arrives after,
   it's recorded to the ledger but **never dispatched** (customer routed to
   support, never "pay again").

Only when A4 is fully green do you proceed to Part B.

---

## Part B — Phase 5 scheduler (twice-daily automatic payouts)

**What it does:** pg_cron fires `settlement-run` at 23:00 and 17:00 UTC
(= 00:00 and 18:00 WAT). Each run claims eligible earnings into an idempotent
batch, sends one Paystack transfer per rider, and leaves uncertain outcomes
for the `transfer.*` webhook to settle.

### B1. Enable extensions (Supabase Dashboard → Database → Extensions)

Enable **`pg_cron`** and **`pg_net`**. Verify:

```sql
SELECT * FROM pg_extension WHERE extname IN ('pg_cron','pg_net');
```

### B2. Set the cron secret (two places, same value)

Generate a long random string, then:

1. Function env: `npx supabase secrets set SETTLEMENT_CRON_SECRET=<random>`,
   then redeploy:

   ```bash
   npx supabase functions deploy settlement-run
   ```

2. Paste the same value into the cron job definitions in B3 (pg_cron calls the
   function with it in the `x-cron-secret` header — the only auth the
   scheduler uses).

### B3. Create the two cron jobs (SQL editor — canonical copy lives in `supabase/scheduler/payout_settlement.sql`)

```sql
-- Midnight run (00:00 WAT)
SELECT cron.schedule(
  'ridely-settlement-midnight',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/settlement-run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<SERVICE_ROLE_KEY>',
      'x-cron-secret', '<SETTLEMENT_CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Evening run (18:00 WAT)
SELECT cron.schedule(
  'ridely-settlement-evening',
  '0 17 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/settlement-run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<SERVICE_ROLE_KEY>',
      'x-cron-secret', '<SETTLEMENT_CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Verify registration, and never use the service-role key anywhere else:

```sql
SELECT jobid, jobname, schedule FROM cron.job;
```

### B4. Dry-run before any money moves

```bash
curl -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/settlement-run?dry_run=true' \
  -H "apikey: <SERVICE_ROLE_KEY>" -H "x-cron-secret: <SETTLEMENT_CRON_SECRET>"
```

This writes nothing and calls no Paystack API. Confirm the response shows the
right `lagos_date`/`slot`, and that riders you expect appear in `planned`
while below-₦50 and no-verified-bank riders appear in `excluded` with reasons.

### B5. Prepare one test rider end-to-end (test mode)

1. Seed a completed, paid delivery for the test rider (run the Phase 3
   card/transfer flow and complete the delivery).
2. In the app (Payouts screen), verify a bank account via `verify-rider-bank`
   (PIN + Paystack resolve + recipient). Confirm the row:

   ```sql
   SELECT account_number, verified_at, recipient_code FROM rider_banks
    WHERE rider_id='<rider>' ORDER BY created_at DESC LIMIT 1;
   -- verified_at and recipient_code must both be set
   ```

3. Trigger a live run manually (same curl without `dry_run`) and check:

   ```sql
   -- batch created, one per (date, slot)
   SELECT slot, status, eligible_rider_count, total_amount_kobo
    FROM payout_batches ORDER BY scheduled_at DESC LIMIT 1;
   -- payout row linked to batch, deterministic ref
   SELECT reference, status, batch_id FROM rider_payout_requests
    ORDER BY created_at DESC LIMIT 1;
   ```

4. Let the `transfer.success` webhook land, then verify: payout →
   `transfer_success`, one `payout` ledger row, batch `paid_amount_kobo`
   bumped, rider receipt sent.
5. **Failure drill**: point a payout at a bad recipient (or drain test balance)
   → payout becomes `transfer_failed_released`, earnings return to eligible,
   entry appears in Finance → Needs attention. **Concurrency drill**: fire the
   function twice at once → second run finds existing payout rows by
   deterministic ref; no double transfer.

### B6. Operate

- **Monitor**: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC
  LIMIT 10;` plus the Admin Finance screen (batch list, per-batch totals,
  Needs attention). Alert on any batch stuck in `processing` or `failed`.
- **Overdue/missed run**: just re-POST the function (or wait for the next
  slot) — the idempotency key resumes or returns the finished batch; never
  hand-craft transfers for a missed window.
- **Pending transfers**: never retry or release by hand. `transfer_pending`
  rows settle only via webhook; ambiguous ones stay reserved, failed ones
  self-release for the next run.
- **Rollback**: `SELECT cron.unschedule('ridely-settlement-midnight');` (and
  evening). Earnings stay accrued and eligible — nothing is lost by stopping
  the scheduler.

---

*Written 2026-10-15 — operational companion to the cashless upgrade
(Phases 3 + 5). Re-check the Paystack channel enablement (A3) and the dry-run
(B4) on every fresh project before going live.*

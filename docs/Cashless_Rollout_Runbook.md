# Cashless Rollout Runbook (Phase 7)

Implements [Ridely_Payment_Implementation.md](Ridely_Payment_Implementation.md) Phase 7.
Do not run any step marked LIVE without explicit authorization. Test everything in
test mode / on staging first.

## 0. Automated verification status (2026-10-15, this branch)

| Check | Result |
|---|---|
| `npm run test:functions` (Deno) | 27/27 pass (checkout, settlement slots, cancellation policy, pricing) |
| `npm test` (Jest) | 47/48 in full run; the 1 failure (`components/Text.test.tsx` scale test) passes in isolation, is timing-sensitive, and is untouched by this work — known flake, not a regression (clean-tree baseline is 48/48) |
| `npx tsc --noEmit` | zero new findings vs stashed baseline (only pre-existing Deno-import noise in `supabase/functions`) |
| `npx eslint` on all touched files | zero new findings vs baseline |
| `deno check` on new/edited edge functions | clean |

What automation does NOT cover (manual below): Paystack test-mode transfers,
webhook delivery, pg_cron firing, real device passes.

## 1. Pre-deploy checklist (Dashboard work)

- [ ] Paystack **test mode**: `bank_transfer` checkout channel enabled for NGN;
      confirm a test transfer settles into Ridely's Paystack balance and fires
      `charge.success` with channel info. If unavailable: STOP, propose the
      supported alternative (spec §Phase 3 — no invented endpoints, no per-dispatch DVA).
- [ ] Paystack webhook URL set to `https://<REF>.supabase.co/functions/v1/paystack-webhook`.
- [ ] Paystack transfer settings: balance-funded transfers enabled; note any
      approval/OTP requirement (transfers needing manual approval will sit in
      `transfer_pending` — visible in Finance → Needs attention).
- [ ] Supabase project: **pg_cron + pg_net** extensions enabled.
- [ ] Supabase secrets set: `PAYSTACK_SECRET_KEY` (test key for now),
      `SETTLEMENT_CRON_SECRET` (long random, same value used in the cron calls),
      `GOOGLE_MAPS_SERVER_KEY`, standard Supabase keys.
- [ ] Pick an admin: after migrations, `UPDATE users SET is_admin = true WHERE id = '<you>';`

## 2. Migrations (staging first, in order)

Apply in filename order; each is additive:

1. `20261015000000_cashless_ledger_foundation.sql` — payments, ledger_entries,
   payout_batches, rider_banks, earnings/payout kobo columns, trigger rewrite.
2. `20261015000001_dispatch_payment_gate.sql` — paid-gate in `accept_delivery()`.
3. `20261015000002_settlement_support.sql` — eligibility/claim/release RPCs.
4. `20261015000003_release_batch_aware.sql` — batch-aware release.
5. `20261015000004_phase6_admin_wallet.sql` — `is_admin`, batch read policy.

Verify on staging (psql / SQL editor):

```sql
-- Backfill parity: one successful payment per paid card delivery
SELECT (SELECT COUNT(*) FROM payments WHERE status='successful')
     = (SELECT COUNT(*) FROM deliveries WHERE payment_status='paid'
        AND payment_reference IS NOT NULL AND payment_method IN ('card','bank_transfer'));
-- Kobo identity holds on every earning
SELECT COUNT(*) FROM earnings WHERE gross_kobo <> fee_kobo + net_kobo; -- expect 0
SELECT COUNT(*) FROM earnings WHERE gross_kobo IS NULL;                 -- expect 0
-- Ledger has collection rows for paid deliveries (cash history excluded by design)
SELECT COUNT(*) FROM ledger_entries WHERE type='collection';
-- Ledger is append-only
UPDATE ledger_entries SET note='x' WHERE false; -- must raise 42501
-- RLS: as an authenticated non-admin, these must return 0 rows written / denied
-- (run with a customer JWT): INSERT INTO ledger_entries ...; INSERT INTO payments ...;
```

Rollback: each migration header documents down-steps (drop new tables/columns only;
old naira columns untouched). Roll back code before rolling back schema.

## 3. Deploy edge functions (order matters)

```bash
npx supabase functions deploy paystack-initialize
npx supabase functions deploy paystack-verify
npx supabase functions deploy paystack-charge
npx supabase functions deploy paystack-callback
npx supabase functions deploy paystack-webhook
npx supabase functions deploy paystack-banks
npx supabase functions deploy create-delivery
npx supabase functions deploy payment-init
npx supabase functions deploy payment-status
npx supabase functions deploy rider-payout
npx supabase functions deploy verify-rider-bank
npx supabase functions deploy settlement-run
npx supabase functions deploy admin-finance
npx supabase functions deploy auto-cancel-pending-deliveries
```

Add the new functions to `scripts/deploy-paystack-functions.mjs` if it enumerates
them (it currently deploys the paystack-* set).

## 4. Scheduler (manual — `supabase/scheduler/payout_settlement.sql`)

Follow the commented steps in that file: two `cron.schedule` calls
(23:00 UTC = 00:00 WAT, 17:00 UTC = 18:00 WAT). Then:

```bash
# Dry run: no writes, no Paystack calls
curl -X POST 'https://<REF>.supabase.co/functions/v1/settlement-run?dry_run=true' \
  -H "apikey: <SERVICE_ROLE_KEY>" -H "x-cron-secret: <SECRET>"
```

Expect `planned`/`excluded` (with reasons) for any eligible test earnings.

## 5. Test-mode end-to-end scripts (staging, Paystack test keys)

Use Paystack test card `5060 6666 6666 6666 666`, any future expiry, PIN 1234,
OTP 123456 (see `supabase/README_PAYMENT_METHODS.md`).

- [ ] **Card regression**: book with new card → WebView → callback → booking
      created `paid` → appears in rider feed → accept → deliver → earning row +
      ledger `rider_accrued` + `commission_earned` (kobo-exact, 15%).
- [ ] **Card with saved card**: charge path → same assertions, exactly one earning.
- [ ] **Transfer happy path**: choose Bank transfer → `payment-init` returns
      instructions → booking row exists with `payment_status='pending'` and is
      INVISIBLE to riders (feed query, `isJobActionableForRider`, direct
      `accept_delivery` RPC all reject) → complete transfer in test channel →
      webhook settles → `paid` → rider notified → accept works exactly once.
- [ ] **Wrong amount**: transfer ≠ expected kobo → payment `failed`, delivery
      stays undispatched, customer gets "needs review" receipt, no arbitrary
      assignment. Refund/rebook via support.
- [ ] **Duplicates**: replay `charge.success` / `transfer.*` from the Paystack
      dashboard → no duplicate ledger rows, no double dispatch, no double payout.
- [ ] **Bad signature**: POST to webhook with wrong `x-paystack-signature` → 401.
- [ ] **COD rejected**: `create-delivery` with `payment_method: 'cash'` → 400;
      cash/bank_transfer through that endpoint → 400 with redirect message.
- [ ] **Expiry**: transfer-pending booking older than 30 min → auto-cancel marks
      delivery `cancelled_no_rider` + payment `expired`; late money settles to
      ledger WITHOUT dispatch (customer routed to support, never "pay again").
- [ ] **Payouts**: seed completed paid deliveries across both windows; verify
      rider bank via app (PIN + resolve); run `settlement-run` dry-run, then live
      in TEST mode; check batch row, per-rider refs, `transfer_pending` → webhook
      `transfer.success` → `transfer_success` + ledger `payout` + batch paid total.
      Below-₦50 and no-bank riders appear in `excluded` and carry forward.
- [ ] **Failure paths**: bad recipient / insufficient Paystack balance → payout
      `transfer_failed_released`, earnings back to eligible, visible in Finance →
      Needs attention. Kill the function mid-run (or run twice concurrently) →
      rerun is idempotent, no double transfer.
- [ ] **Security**: no `PAYSTACK_SECRET_KEY` / service-role key in client bundle
      (`grep` the built JS); customer JWT cannot write payments/ledger/earnings;
      webhook rejects unsigned calls; admin screens deny non-admins (UI + 403
      from `admin-finance`).

## 6. Controlled rollout

1. Staging green on all of §5 → internal live pennies (real ₦50–₦100 bookings,
   real small transfers, immediate refund/reversal check).
2. Scheduler dry-run in prod → small live batch (one rider, minimum amount) →
   full twice-daily runs.
3. % of bookings → full traffic. Keep the old app build installable for one
   release cycle.
4. Switch Paystack to **live** keys only after test-mode §5 is fully green;
   repeat the transfer happy path once with live keys before opening traffic.

## 7. Manual device pass (both themes, per touched screen)

Booking confirmation (card + transfer + waiting state + 15 s poll), rider
Payouts screen (summary, bank verify, histories), Earnings screen, Admin
Finance + Batch detail, add-payment screen (no cash option), support FAQ.
Cover loading / empty / error / retry states; confirm pending transfers are
never displayed as received.

## 8. Known limitations / follow-ups

- `verify_delivery_handoff` cash-settlement branch retained for pre-existing cash
  rows only (no new cash can be created). Decide: force-cancel legacy cash or
  let it drain naturally.
- Admin dashboard is read-only by design (no manual retry — see function header).
  If ops needs interventions, they are: release via next run (automatic) or
  support-led refund/rebook (manual, via Paystack dashboard + a ledger
  `adjustment` row with reason).
- Settlement runs are initiation cutoffs, not bank-credit guarantees.
- `payment-status` GET carries the reference in the URL (logged by edge infra);
  acceptable for non-secret refs, noted for future hardening.
- Jest `components/Text.test.tsx` flake (timing-sensitive, passes in isolation,
  unrelated files) — consider quarantining or fixing the timer dependency.

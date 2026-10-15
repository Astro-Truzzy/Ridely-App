# Ridely Cashless Payment & Automated Payout Implementation

> Merged spec for use in Claude Code with the Ridely repository open.
> Source: (1) 7-phase cashless upgrade plan + (2) Payment update — central account, midnight schedule, kobo precision.
> This file supersedes both sources where they conflict.

## 0. How to use this file

1. Open your Ridely repository in Claude Code, in the same session for all phases.
2. Work one phase at a time, in order. Review and test each phase before moving on.
3. Do not let Claude rebuild the payment system in parallel — it must inspect and extend the existing codebase.
4. Do not give Claude production secrets in prompts. Use environment / secret management.
5. Do not initiate real transfers or switch live booking rules without explicit authorization.

## 1. Target system — agreed business rules

Approach this as a **payments and financial-settlement upgrade to the existing application, not a complete rebuild**. Inspect current codebase, understand how card payments and rider earnings already work, then add the bank-transfer workflow without breaking existing functionality.

### Core rules

1. **Customers pay before dispatch.** Customers can pay by card or bank transfer. A delivery must not become available to riders until payment has been verified by the backend.
2. **Ridely controls the financial records.** Every delivery has a payment record, commission calculation, rider earning entry, and settlement status. Cash-on-delivery is removed from the normal booking workflow.
3. **Riders are paid automatically twice daily:**
   - `12:00 AM (midnight), Africa/Lagos`
   - `6:00 PM, Africa/Lagos`
   
   Eligible earnings not included in one run carry forward to the next run.
4. **Showing a bank account number is not proof of payment.** Verify incoming transfers via a supported Paystack transfer-payment product, verified payment webhook, or other suitable provider integration. Claude must inspect the existing Paystack setup and confirm which option it supports before implementing.
5. **Payout schedule uses a reliable server-side scheduler**, not a timer in the mobile app. A payout is marked successful only when the provider confirms the transfer.
6. **Central collection account.** Customer transfers go to Ridely's central bank account connected to Paystack. Do NOT create a separate bank account or dedicated virtual account per dispatch. Because multiple customers pay into one account, do NOT assume arrival of money identifies the booking — match with a verified Paystack transaction reference or other provider-supported method.
7. **Currency in kobo.** Store and calculate monetary values in integer minor units (kobo for NGN), not floats. Do not unnecessarily round to whole naira. If existing business rules require whole-naira prices, apply one consistent documented rounding rule at the pricing stage only — do not round different parts of the same transaction independently.

> **Conflict resolution note:** The earlier draft used 12:00 PM (noon) + 6:00 PM. The update corrects this to **12:00 AM midnight + 6:00 PM Africa/Lagos**. Use midnight + evening everywhere below. Settlement runs are cutoffs that initiate/track payouts — they do not guarantee bank credit at exactly that minute, which depends on Paystack/bank processing.

### Ridely context (to be verified in Phase 1)

- Customer booking / delivery creation exists.
- Rider accounts + job acceptance exist.
- Paystack card payment integration exists.
- Rider in-app wallet displays earnings.
- Commission: Ridely earns 15% of delivery fee. Example for ₦5,000: Ridely ₦750, rider net ₦4,250.
- Stack to confirm by inspection: React Native/Expo, Supabase, Edge Functions, Node.js, or other.

### Paystack capability checks required before building

- **Customer bank transfers:** Paystack supports dedicated virtual accounts for Nigerian bank transfers, with webhooks on incoming transfers. A DVA is typically customer-linked, not per-ride. Claude must evaluate whether a transaction-specific transfer checkout, customer-linked virtual account, or other officially supported collection mechanism fits the central-account model. Do not invent endpoints, statuses, webhook events, or allocation features.
- **Rider payouts:** Paystack Transfer Recipient + Transfer APIs send money to Nigerian bank accounts (amounts in kobo for NGN). Automated payouts depend on eligibility, configuration, available balance, and approval/OTP settings.
- References:
  - Paystack bank transfers and dedicated virtual accounts
  - Paystack Transfers API
  - Paystack Transfer Recipients API

---

## Phase 1 — Audit the existing Ridely application

Start here. Do NOT modify files before understanding the existing payment system.

### PHASE 1 PROMPT (copy-paste):

```
PHASE 1: AUDIT RIDELY'S EXISTING PAYMENT AND FINANCIAL SYSTEM

You are acting as a senior full-stack engineer and fintech payment architect on my existing delivery platform, Ridely.

Goal is to upgrade to a fully cashless workflow: bank transfer + card, reliable accounting, automated rider payouts at 12:00 AM midnight and 6:00 PM Africa/Lagos.

Existing context to VERIFY by inspection, not assumption:
- Customer booking and delivery creation
- Rider accounts and job acceptance
- Existing Paystack card integration
- Rider in-app wallet earnings display
- 15% commission model
- Backend + database (Supabase / Postgres / Edge Functions / Node.js — confirm actual stack)

Target requirements:
1. Card + bank transfer; keep card working.
2. Remove cash-on-delivery from normal booking flow; preserve history.
3. Transfers go to Ridely central account (no per-dispatch DVA). Match via verified Paystack reference.
4. Backend-verified payment before dispatch; customers can never mark own payment successful.
5. 15% commission; track earnings separately from payouts.
6. Twice-daily payouts: 12:00 AM + 6:00 PM Africa/Lagos, server scheduler only.
7. Carry-forward unpaid eligible earnings; never record pending/failed/ambiguous as successful.
8. Auditable, client-tamper-proof financial records; money in integer kobo.

Tasks — inspect repo and identify:
- Framework + folder structure
- Booking creation flow + price calculation
- Paystack card implementation: init, callback, webhooks
- Supabase tables, migrations, triggers, RLS, Edge Functions if applicable
- How rider earnings / wallet balances are calculated + stored
- How jobs become available to riders
- How rider bank details are stored
- Any existing payout / scheduled-job / cron functionality
- Auth/authz, admin dashboard, transaction history
- Full lifecycle: checkout → payment → dispatch → completion → commission → earnings

Identify every place cash is allowed or assumed.

Deliverables:
1. Architecture summary from actual code
2. Relevant files + tables map
3. Current payment lifecycle description
4. Bugs, security risks, accounting gaps
5. Proposed cashless architecture fitting existing codebase
6. Migration plan preserving existing data
7. Required Paystack config / capability checks (transfer collection for central account, transfer sending, webhook support, balance/OTP/approval)
8. Phased implementation plan

Do not invent table names, APIs, paths, or features. Do not replace card integration without demonstrated need. Do not modify production code or run destructive DB changes in this audit. Present findings for review before proceeding.
```

After Phase 1: verify Claude found real wallet logic, Paystack integration, and dispatch mechanism. If it guessed, ask it to inspect the relevant files.

---

## Phase 2 — Financial database and ledger

Establishes the source of truth. Must distinguish earnings from money actually paid.

### PHASE 2 PROMPT (copy-paste):

```
PHASE 2: IMPLEMENT RIDELY'S FINANCIAL LEDGER AND DATABASE FOUNDATION

Using approved Phase 1 findings, design + implement DB changes for cashless + automated payouts. Use existing DB/framework. If Supabase, use Postgres migrations + server functions. Extend existing structures; do not create parallel financial systems.

1. Payment records — per delivery, per customer:
unique internal payment ID, delivery ID, customer ID, provider (paystack), method (card | bank_transfer), unique payment reference, expected amount NGN (kobo), confirmed amount (kobo), status (pending | successful | failed | expired | refunded | partially_refunded), provider transaction ID, created/confirmed timestamps, failure/expiry/refund details.
Lifecycle must be consistent. Never mark success on client return or client-submitted status.

2. Financial ledger (auditable, append-only — use reversals/adjustments, never silent overwrites):
collection, commission earned, rider earnings accrued, payout obligations, successful payouts, failed/reversed payouts, refunds/reversals, approved adjustments.
Each entry: unique ID, delivery/payout ref, currency, amount (kobo), type, timestamp. Document debit/credit or signed-entry convention. Explicit commission-rounding policy; integer kobo math.

3. Rider earnings + payout tracking — extend wallet to distinguish:
gross earnings, commission deductions, net earnings, awaiting payout, reserved in batch, successfully paid, failed/reversed, total paid to date.
Do not treat displayed balance as proof of bank transfer.
Payout records: rider ID, unique payout ref, batch ID, amount kobo, currency, destination bank ref, status, provider transfer ref, attempt count, failure reason, created/submitted/completed timestamps.

4. Payout batches:
scheduled run (00:00 | 18:00), Africa/Lagos business date, scheduled execution time, unique idempotency key, status, eligible rider count, total amount, success/pending/failed totals, execution/completion timestamps. Unique batch identity so retried scheduler cannot duplicate.

5. Correctness + security:
FKs, constraints, indexes, uniqueness. If Supabase: correct RLS — customers/riders cannot edit payments, commissions, ledger, payouts; only trusted server code can. Keep service-role + Paystack secrets out of clients. Review existing policies. Use transactions/atomic ops. Guarantee: no double commission/earnings per delivery, no double-credit payment, no double-claim payout by concurrent workers.

6. Existing data:
Inspect wallet/delivery records before migrating. Preserve history; distinguish historical vs new earnings. Do not assume historical balances are unpaid or settled. Do not fabricate payouts for unverifiable transfers. If assumptions needed, stop and report for review.

Deliverables: migrations created/modified, schema summary, calculation rules, RLS/authz changes, migration + rollback instructions, tests for constraints, duplicate events, concurrent updates. Do not proceed to provider integration until DB is consistent + tested.
```

---

## Phase 3 — Bank transfer checkout (central account)

Customer sees bank details, amount, status in-app. No receipt sent to admin for manual verification.

### PHASE 3 PROMPT (copy-paste):

```
PHASE 3: IMPLEMENT PAYSTACK BANK TRANSFER CHECKOUT (CENTRAL ACCOUNT)

Extend existing Paystack integration + Phase 2 schema. Keep card working.

1. Inspect capabilities FIRST:
Determine which officially supported Nigerian bank-transfer flow fits a single central collection account. Evaluate checkout flow supporting bank transfer with payment instructions vs customer-linked virtual account vs other supported mechanism. Do not assume a DVA is unique per delivery. Do not invent endpoints/statuses/webhooks. If current product cannot support required flow, explain + propose supported alternative before coding. Do not hardcode placeholder account details; if central account/config missing, identify what must be configured.

2. Checkout UI — add method selector (Card | Bank transfer), preserve design/nav:
- Card → existing flow.
- Bank transfer → init on backend, display verified instructions returned by provider: bank name, account name, account number (central account), exact amount, payment reference/narration, order ref, expiry if supported, live status. Copy-account-number button + waiting-for-payment state. Tell user not to mark complete manually; app updates only on server confirmation.

3. Server-side init — authenticate customer, validate delivery + price, use authoritative amount (kobo, do not trust client), generate unique ref, link customer + delivery, store pending, return only client-needed fields. Guard duplicate/concurrent inits + ref reuse. Never mark success at init.

4. Webhook verification:
Verify Paystack signature officially, reject invalid, validate event type, match provider ref to payment, confirm amount + currency, re-verify transaction via provider where needed, ensure idempotent (not already processed), persist safely, return correct response. Support retries + out-of-order without duplication. Never trust redirects, screenshots, receipts, or manual refs. Wrong amount / late / duplicate → record + route to exception process; never assign unmatched payment arbitrarily. Must handle multiple payers into one central account via verified ref matching.

5. Confirmation UX:
On verified success: update payment, ledger collection entry, trigger dispatch eligibility, notify customer, refresh checkout, prevent duplicate notifications/bookings. Pending → waiting state + safe refresh. Failed/expired → message + safe retry without duplicate payable orders/payments.

6. Security + tests:
Tests for success, wrong amount/currency, invalid signature, duplicate webhooks, pending/failed/expired/late, unknown ref, repeated submissions, network interruption. Document dashboard config + env vars. No live secrets in code.

Deliver complete checkout, init, webhook, persistence, status refresh + tests. Document test-mode testing before production.
```

Illustrative UI (not live — details must come from provider):

> Pay for your delivery / Ref: RDL-10520 / Total: ₦5,000.00 / Bank transfer — transfer exact amount to account shown / [Bank details appear after backend init] / Status: Awaiting payment

---

## Phase 4 — Payment-before-dispatch enforcement

Backend check at creation and acceptance — not just hidden buttons.

### PHASE 4 PROMPT (copy-paste):

```
PHASE 4: ENFORCE PAYMENT-BEFORE-DISPATCH

Strict rule: delivery must not be available for rider acceptance until customer payment is backend-verified.

Flow:
1. Customer creates request → 2. Authoritative fee → 3. Select card/transfer → 4. Init pending → 5. Customer pays → 6. Backend verifies → 7. Persist payment + ledger → 8. Eligible for dispatch → 9. Rider matching → 10. Accept + complete → 11. Record earnings + commission exactly once.

Enforce everywhere: inspect every path that creates/publishes delivery to feed, notifies/matches riders, allows accept, retries dispatch. Add authoritative backend checks at each entry. Backend must reject publish/accept of unpaid delivery even on direct endpoint call. Keep payment status separate from delivery status; add payment states only where needed.

Commission at completion from trusted price at 15% (e.g. ₦5,000 → ₦750 commission, ₦4,250 rider net). Integer kobo, approved rounding. Single transaction / idempotent workflow. Completion accrues earning; payout happens only via scheduled settlement.

Remove cash: remove COD option from customer UI + booking API + default cash branches that bypass verification. Preserve historical cash records; do not delete or mark old deliveries paid without evidence. Document effect of any other payment methods before disabling.

Handle: payment succeeds during dispatch attempt, duplicate webhooks, early accept attempt, dispatch retry after error, app closed after pay, lost confirmation response, double-accept race, post-payment refund/reversal. Use transactions, conditional updates, uniqueness.

Acceptance tests must prove: pending/failed cannot dispatch; verified card + verified transfer can dispatch exactly once; no double dispatch; earnings once; cash unavailable for new bookings; history intact. Report files + DB objects changed.
```

---

## Phase 5 — Twice-daily payout engine (midnight + evening)

Most financially sensitive. Build around Paystack transfer behaviours — API acceptance ≠ success.

### PHASE 5 PROMPT (copy-paste):

```
PHASE 5: IMPLEMENT AUTOMATED TWICE-DAILY RIDER PAYOUTS (00:00 + 18:00 Africa/Lagos)

Build reliable engine on existing backend + DB + Paystack. Schedule:
- 12:00 AM midnight Africa/Lagos
- 6:00 PM Africa/Lagos
Autonomous, no manual trigger for normal runs. Scheduler triggers process; bank-credit timing depends on Paystack/banks.

1. Eligibility — earning eligible only when: delivery completed per payout policy, customer payment verified, commission complete, not already paid, not reserved in active payout, rider has valid verified payout details, no review/compliance hold. Document refunds/disputes/cancellations/reversals/minimums. Record exclusion reasons; make eligible later when resolved.

2. Windows (Africa/Lagos explicit, store UTC, compute schedule in Africa/Lagos):
- 00:00: process eligible since previous successful cutoff incl. overnight + carry-forward. Unique batch, reserve earnings, per-rider totals, initiate.
- 18:00: process eligible since 00:00 cutoff + carry-forward, exclude paid/in-flight. Next-day 00:00 picks up post-18:00 accruals.
Clear cutoff semantics so boundary deliveries are neither doubled nor missed. No app timers.

3. Scheduler — use production server mechanism (if Supabase: evaluate Supabase Cron + DB functions vs scheduled Edge Functions per existing arch; else backend-native scheduler). Job must run 00:00 + 18:00 Africa/Lagos daily, get-or-create unique batch (idempotency key), handle retries, prevent concurrent reservation of same earnings, log status/errors/completion, alert operator on failure. Recover overdue safely without duplicates. Scheduling ≠ exact-time guarantee.

4. Amounts — aggregate authoritative unpaid ledger entries per rider per batch. 15% model, kobo math (e.g. ₦5,000 → ₦750 → ₦4,250 net). Never use app wallet display as source.

5. Paystack transfers — inspect docs + account setup. Backend must: validate bank details, create/reuse transfer recipient, store recipient code securely, unique payout ref, check sufficient funds pre-initiation, initiate in kobo, handle approval/OTP flow, persist provider response + ref, process verified status updates, reconcile ambiguous before retry. Never assume pending = success; never blind-resubmit after timeout without checking original ref/status. Mark success only on reliable provider confirmation. If transfers disabled / insufficient balance: record hold/failure, notify admin, retain earnings safely.

6. Idempotency — unique internal ID + ref + batch + earning set + persistent status per payout. Reserve atomically pre-transfer. Guarantees: concurrent workers cannot double-pay; repeated scheduler cannot re-pay same earning; webhook retry cannot double-settle; ambiguous cannot be blind-resubmitted; failed does not lose entitlement — release/reclassify safely for later run; ambiguous stays in reconciliation.

7. Rider bank details — inspect profile schema; add/extend if needed: account name, number, bank name/code, verification status, recipient code. Provider-supported validation where available. Authz + storage controls; no cross-rider/customer exposure. Verify before use; pending payouts must not go to unverified new destination after change.

8. Reconciliation — track transitions: accrued → eligible → reserved → pending provider → paid; plus failed/reversed/carried-forward. Record every transition. Reconcile refs, statuses, amounts, timestamps, recipients. Never delete/overwrite history on failure/reversal.

Deliverables: scheduled function, batch logic, eligibility + aggregation, transfer integration, status lifecycle, retry + reconciliation, monitoring. Tests: both windows, Lagos TZ, overnight, carry-forward, zero earners, invalid bank, insufficient balance, pending/failed/timeout, duplicate scheduler, concurrent workers, repeated webhooks, reversals. Document scheduler config + safe manual dry-run. No real payouts in dev/test without explicit auth.
```

Schedule mental model:

- `12:00 AM` — pays eligible since prior cutoff, incl. overnight + carry-forward.
- `6:00 PM` — pays eligible since midnight + carry-forward, excl. in-flight.
- Next `12:00 AM` — picks up post-6PM accruals + anything still outstanding. Never double-count or double-pay.

---

## Phase 6 — Rider wallet + admin finance dashboard

Wallet becomes transparent earnings + payout history, not just a rising number.

### PHASE 6 PROMPT (copy-paste):

```
PHASE 6: UPDATE RIDER WALLET AND ADMIN FINANCIAL DASHBOARD

Preserve design system + navigation. Connect to real backend, no hardcoded samples.

Rider wallet summary:
today gross, today commission, today net, awaiting payout, reserved for pending, successfully paid, next scheduled payout (00:00 / 18:00 Africa/Lagos), most recent payout status. Label accrued vs bank-paid clearly. Never show pending transfer as received.

Transaction history per delivery: ref, completion datetime, gross fee, 15% commission, net earnings, earnings status. Per payout: ref, amount, scheduled settlement time, masked destination, status, failure/delay info. Filters for earnings / commission / payouts.

Bank settings: review + update via secure flow, provider validation where available, mask numbers, prevent pending payout to unverified new destination.

Admin (authorized only): total completed value, commission earned, rider earnings accrued, payouts completed, outstanding obligations, reserved pending, failed/reversed, upcoming batches + per-batch totals, unmatched/unreconciled, refunds/reversals. Batch detail: riders, per-rider amounts, provider ref, status, failure reason. Controls: view history/batches, investigate failures, retry only when safe, hold with reason, release via audit, export reports. Never silently edit completed entries or mark unverified as successful; adjustments record admin identity + reason + timestamp + ledger entry. Enforce in backend, not just UI.

UI: existing components, works on target devices, loading/empty/error/retry states, explain delays/failures without leaking sensitive data.

Deliver wallet, history, bank settings, admin views + authz + integration tests per view.
```

---

## Phase 7 — End-to-end testing + production rollout

Do not go live because code compiles — prove lifecycle with test transactions.

### PHASE 7 PROMPT (copy-paste):

```
PHASE 7: END-TO-END TESTING AND PRODUCTION READINESS REVIEW

No unrelated features/redesigns.

1. Payments: card still works; transfer checkout returns valid instructions (central account); pending does not dispatch; verified activates dispatch exactly once; wrong amounts → exception process; invalid signatures rejected; duplicates do not double entries; failed/expired do not dispatch; retries do not duplicate; cancellation/refund consistent.

2. Delivery + earnings: only verified paid can dispatch; direct API accept of unpaid rejected; earnings once per completion; 15% commission; correct net (kobo-exact); COD disabled for new bookings; history intact.

3. Payouts (test clock/fixtures for 00:00 + 18:00 Africa/Lagos): both runs scheduled; overnight in midnight run; post-midnight in evening run; carry-forward works; in-flight not re-paid; repeated scheduler safe; failures stay outstanding; ambiguous reconciled pre-retry; successes reflected in ledger + wallet; reversals preserve history.

4. Paystack (test mode + mocks): success/pending/failed payments + transfers, insufficient funds, bad recipients, timeouts, duplicate/delayed webhooks, status reconciliation. Never treat HTTP completion as success.

5. Security: no exposed secrets, no client authority over payment status / commission / payout amounts, RLS + backend authz complete, webhook endpoint protected + signature-validated, no races/duplicates, no unauthorized bank changes, no sensitive logs, no admin escalation.

6. Readiness: env vars, webhook config, account permissions, recipient setup, settlement balance, scheduler config (verify Africa/Lagos = 00:00 + 18:00), monitoring/alerts, migrations, rollback, test/prod separation. No real payouts / live transfers / prod booking-rule switch without explicit auth.

Final report: implemented features, files + migrations changed, test results (incl. failed/skipped), remaining limitations, dashboard config required, deploy + rollback steps, controlled rollout checklist. Do not claim completeness without implementation + passing tests.
```

---

## Final operating notes

- Keep card working; transfer extends checkout.
- Never use app clock for payouts; backend scheduler in Africa/Lagos.
- Never pay twice: unique earning→payout linkage, persistent refs, reconciliation.
- Check Paystack balance + transfer permissions; receiving vs sending are separate capabilities.
- Test first: transfers, duplicate webhooks, failed payouts, delayed notifications.
- Treat 00:00 + 18:00 as settlement cutoffs that initiate/track payouts, not guaranteed bank-credit times.

---

*Generated 2026-10-15 — merged Ridely payment spec (midnight + 6PM, central account, kobo precision). Review payout times + central-account matching rule before running Phase 1.*

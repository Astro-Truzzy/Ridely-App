# Paystack Payment System – Implementation Spec

Production-ready Paystack integration for Expo (React Native) with Supabase backend. Used for **wallet funding** and **Add Card** flows.

---

## ⛔ Constraints (MUST NOT)

- **Do NOT** use `@paystack/inline-js`
- **Do NOT** use Paystack inline popup
- **Do** use: **backend transaction initialization + WebView**

---

## 🧱 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Expo (React Native) |
| Backend | Supabase (Postgres + Edge Functions) |
| Payments | Paystack |
| Payment UI | React Native WebView |

---

## 1️⃣ Supabase Edge Function: Initialize Payment

**Purpose:** Start a Paystack transaction from the backend so the secret key is never sent to the client.

### Behavior

- **Input:** `email`, `amount` (and any needed metadata, e.g. `user_id`).
- **Action:** Call Paystack:
  - **Endpoint:** `POST https://api.paystack.co/transaction/initialize`
  - **Auth:** Paystack **SECRET** key from Supabase env (e.g. `PAYSTACK_SECRET_KEY`).
  - **Amount:** Convert to **kobo** before sending.
  - **Channels:** Force card-only: `channels: ["card"]`.
- **Output (to client):**
  - `authorization_url` – URL to open in WebView.
  - `reference` – transaction reference for status/webhook.

**Rule:** The secret key must **never** be exposed to the frontend.

---

## 2️⃣ Expo App Flow

1. User taps **"Add Card"** or **"Fund Wallet"**.
2. App calls the Supabase Edge Function (initialize payment).
3. App receives `authorization_url` (and `reference`).
4. Open `authorization_url` in a **React Native WebView** screen.
5. Show a **loading indicator** while the page loads.
6. **Do not** use inline payment UI; the full flow happens inside the WebView.

---

## 3️⃣ Supabase Webhook Endpoint

**Purpose:** Handle Paystack events (e.g. successful charge) and persist card data.

### Requirements

- **Verify** Paystack signature (using secret key) before processing.
- **Handle** `charge.success` (or equivalent success event).
- **Extract** from event payload:
  - `event.data.authorization.authorization_code`
  - (and any other needed fields: last4, exp_month, exp_year, brand, etc.)
- **Store** `authorization_code` (and card metadata) in Supabase.
- **Link** stored data to the correct **user** (e.g. via `user_id` or Supabase auth).
- **Idempotency:** Webhook must be **secure** and **prevent duplicate processing** (e.g. by `reference` or event id).

---

## 4️⃣ Database Schema (Supabase Postgres)

### `users_wallet`

| Column     | Type    | Notes                    |
|------------|---------|--------------------------|
| id         | uuid    | PK                       |
| user_id    | uuid    | FK → `auth.users`        |
| balance    | numeric | Wallet balance           |
| created_at | timestamptz | Default `now()`     |

### `saved_cards`

| Column             | Type    | Notes        |
|--------------------|---------|--------------|
| id                 | uuid    | PK           |
| user_id            | uuid    | FK to user   |
| authorization_code | text    | From Paystack |
| last4              | text    | Last 4 digits |
| exp_month          | text    | Expiry month |
| exp_year           | text    | Expiry year  |
| brand              | text    | Card brand   |
| created_at         | timestamptz | Default `now()` |

### `transactions`

| Column     | Type    | Notes                    |
|------------|---------|--------------------------|
| id         | uuid    | PK                       |
| user_id    | uuid    | FK to user               |
| amount     | numeric | Amount                   |
| type       | text    | `credit` \| `debit`      |
| reference  | text    | Paystack reference       |
| status     | text    | e.g. success, failed     |
| created_at | timestamptz | Default `now()`     |

---

## 5️⃣ Future: Charge Saved Card

**Purpose:** Charge a previously saved card (e.g. for wallet top-up or orders).

- **Endpoint:** `POST https://api.paystack.co/transaction/charge_authorization`
- **Required body fields (conceptually):**
  - `authorization_code` – from `saved_cards`
  - `email` – user email
  - `amount` – in **kobo**

This should be implemented as a **Supabase Edge Function** (or RPC) so the secret key stays on the server. Frontend only triggers the charge with user/card identifiers.

---

## 6️⃣ Security Requirements

- Use **Supabase environment variables** for Paystack keys (secret for backend, no secret on client).
- **Validate** Paystack webhook signatures before processing.
- **Never** trust frontend for “payment success”; rely on webhook (and/or verified backend status).
- **Log** all payment/transaction attempts and outcomes.
- **Handle** failed payments explicitly (user feedback, retries, support).

---

## 7️⃣ Deliverables Checklist

| # | Item | Description |
|---|------|-------------|
| 1 | **Initialize payment Edge Function** | Supabase function that calls Paystack `transaction/initialize`, returns `authorization_url` + `reference`. |
| 2 | **Webhook Edge Function** | Supabase function that verifies signature, handles `charge.success`, stores `authorization_code` and links to user. |
| 3 | **Database SQL schema** | Migrations or SQL for `users_wallet`, `saved_cards`, `transactions`. |
| 4 | **Expo PaymentScreen** | Screen that opens Paystack URL in React Native WebView with loading state. |
| 5 | **Charge saved card function** | Example/server function that calls Paystack `transaction/charge_authorization` with `authorization_code`, `email`, `amount` (kobo). |

---

## Summary

- **Backend:** Initialize transaction and charge saved cards via Edge Functions; webhook updates DB and links cards to users.
- **Frontend:** Call Edge Function → get `authorization_url` → show it in WebView (no inline Paystack popup).
- **DB:** Wallets, saved cards (with `authorization_code`), and transactions.
- **Security:** Keys in env, verify webhooks, no trust on frontend for success, log and handle failures.

Implementation target: **production-ready**, **scalable** for a delivery app (e.g. Ridely).

**Do NOT use Paystack inline.**

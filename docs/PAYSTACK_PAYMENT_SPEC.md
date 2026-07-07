# Paystack Payment System – Production Spec

Refactor and implement a production-ready Paystack payment system for the Expo (React Native) app using Supabase as the backend.

---

## Important constraints

- **Do NOT use** `@paystack/inline-js`
- **Do NOT use** Paystack inline popup
- **Use:** backend transaction initialization + WebView only

**Scope:** Wallet funding and “Add Card” functionality.

---

## Tech stack

| Layer        | Technology           |
| ------------ | -------------------- |
| Mobile       | Expo (React Native)  |
| Backend      | Supabase (Postgres + Edge Functions) |
| Payments     | Paystack             |
| In-app page  | React Native WebView |

---

## 1. Supabase Edge Function: Initialize Payment

Create an Edge Function that:

- **Input:** Receives `email` and `amount`.
- **Action:** Calls Paystack:
  - `POST https://api.paystack.co/transaction/initialize`
  - Uses Paystack **SECRET** key from Supabase environment variables.
  - Converts amount to **kobo**.
  - Forces card payment with: `channels: ["card"]`.
- **Output:** Returns:
  - `authorization_url`
  - `reference`

**Security:** The secret key must **never** be exposed to the frontend.

---

## 2. Expo app flow

- User taps **“Add Card”** or **“Fund Wallet”**.
- App calls the Supabase Edge Function (initialize payment).
- App receives `authorization_url`.
- App opens `authorization_url` inside a **React Native WebView** screen.
- Show a **loading indicator** while the page loads.
- **Do not** use inline payment (no inline JS, no popup).

---

## 3. Supabase webhook endpoint

Create an Edge Function to handle Paystack webhooks.

- **Verify** Paystack signature before processing.
- **Handle** `charge.success`.
- **Extract** from event payload:
  - `event.data.authorization.authorization_code`
- **Store** `authorization_code` in Supabase and link it to the user.
- **Security:** Secure the endpoint; prevent duplicate processing (idempotency).

---

## 4. Database schema (Supabase Postgres)

Create the following tables.

### `users_wallet`

| Column     | Type    | Notes                    |
| ---------- | ------- | ------------------------ |
| id         | uuid    | Primary key              |
| user_id    | uuid    | References `auth.users`  |
| balance    | numeric |                          |
| created_at | timestamptz |                   |

### `saved_cards`

| Column             | Type | Notes        |
| ------------------ | ---- | ------------ |
| id                 | uuid | Primary key  |
| user_id            | uuid |              |
| authorization_code | text | From Paystack |
| last4              | text |              |
| exp_month          | text |              |
| exp_year           | text |              |
| brand              | text |              |
| created_at         | timestamptz |     |

### `transactions`

| Column     | Type    | Notes                    |
| ---------- | ------- | ------------------------ |
| id         | uuid    | Primary key              |
| user_id    | uuid    |                          |
| amount     | numeric |                          |
| type       | text    | `credit` / `debit`       |
| reference  | text    | Paystack reference       |
| status     | text    |                          |
| created_at | timestamptz |                   |

---

## 5. Future: charge saved cards

Implement a function to charge saved cards using Paystack:

- **Endpoint:** `POST https://api.paystack.co/transaction/charge_authorization`
- **Required fields:**
  - `authorization_code`
  - `email`
  - `amount` (in kobo)

---

## 6. Security requirements

- Use **Supabase environment variables** for Paystack keys (secret never in client).
- **Validate** webhook signatures (Paystack signature header).
- **Never** trust frontend for payment success; verify via webhook or server-side verify API.
- **Log** all transactions (e.g. in `transactions` table and/or logs).
- **Handle** failed payments and errors explicitly (user feedback, retries, idempotency).

---

## 7. Deliverables checklist

- [ ] Supabase Edge Function: **initialize payment** (with `channels: ["card"]`, returns `authorization_url`, `reference`).
- [ ] Supabase Edge Function: **webhook** (signature verification, `charge.success`, store `authorization_code`, idempotent).
- [ ] Database: **SQL schema** for `users_wallet`, `saved_cards`, `transactions` (and any RLS/migrations).
- [ ] Expo: **PaymentScreen** (or equivalent) that uses WebView to open `authorization_url` and shows loading.
- [ ] Example/server function to **charge saved card** via `charge_authorization`.

Implementation must be **production-ready** and **scalable** for a delivery app (e.g. Ridely).

---

## Do not use

- Paystack inline JS / inline popup.

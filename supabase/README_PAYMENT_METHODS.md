# Payment methods integration

The app stores **payment method metadata** in Supabase (`payment_methods` table): label, last 4 digits, brand, expiry, and an optional gateway ID. Full card numbers are never stored.

---

## Paystack Test – quick start (already wired in Ridely)

To **complete a successful test transaction** (e.g. to reactivate a dormant Paystack account) and use card payment on the booking confirmation screen:

### 1. Get your Test Secret Key

1. Open [Paystack Dashboard](https://dashboard.paystack.com) and ensure you’re in **Test mode** (toggle in the dashboard).
2. Go to **Settings → API Keys & Webhooks**.
3. Copy your **Test Secret Key** — the one that **starts with `sk_test_`**. Do **not** use the Public Key (`pk_test_`); the server must use the **Secret** key.


### 2. Set the secret in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Edge Functions**.
2. For **paystack-initialize**, **paystack-verify**, **paystack-callback**, and **paystack-charge**, go to the function → **Secrets** (or use Project Settings → Edge Functions → Secrets).
3. Add a secret: name **`PAYSTACK_SECRET_KEY`**, value = your Test Secret Key (`sk_test_...`).

Alternatively, in Supabase CLI:

```bash
npx supabase secrets set PAYSTACK_SECRET_KEY=sk_test_your_key_here
```
### 3. Deploy the Edge Functions

From the project root (where `supabase/` lives), run **each** command separately (the project has the Supabase CLI as a dev dependency, so use `npx`):

```bash
npx supabase functions deploy paystack-initialize
npx supabase functions deploy paystack-verify
npx supabase functions deploy paystack-callback
npx supabase functions deploy paystack-charge
```

**Saved cards at booking:** After adding a card (Profile → Payment methods → Add card), confirm a booking with that card selected. The app calls `paystack-charge` with your saved Paystack authorization code — no WebView unless you choose “Pay with a different card”.
```

If you don’t have the Supabase CLI linked to your project yet, run `npx supabase login` and then `npx supabase link --project-ref YOUR_PROJECT_REF` (find the ref in Supabase Dashboard → Project Settings → General).

### 4. Run a test payment in the app

1. In the app, go through **Book a Delivery** (choose size → addresses & time → pricing) to the **Confirmation** screen.

2. Leave **Credit Card** selected and tap **Confirm & Pay**.

3. The Paystack hosted page opens in a modal. Use Paystack’s **test card**:
   - **Card number:** `5060 6666 6666 6666 666`
   - **Expiry:** any future date (e.g. 12/30)
   - **CVV:** any 3 digits
   - **PIN:** 1234 (if asked)
   - **OTP:** 123456 (if asked)

4. Complete payment. You’ll be redirected to a “Payment successful” page; the app will verify the transaction and then create the booking.

One successful test transaction should clear the “account dormant” warning in your Paystack Test dashboard.

### If you see "Failed to initialize payment" or "Payment error"

The app will now show the **exact error** from the server when possible. Check:

1. **"PAYSTACK_SECRET_KEY not set"** — Add the secret in Supabase: **Project Settings → Edge Functions → Secrets**. Name: `PAYSTACK_SECRET_KEY`, value: your Test secret key (`sk_test_...`). Then run: `npx supabase functions deploy paystack-initialize`
2. **"Missing authorization header"** — The app now sends the Supabase anon key in the `Authorization` header. Ensure `.env` has `EXPO_PUBLIC_SUPABASE_ANON_KEY` set (same as for the Supabase client). Restart the dev server after changing `.env`.
3. **"EXPO_PUBLIC_SUPABASE_URL is not set"** — In `.env` set `EXPO_PUBLIC_SUPABASE_URL` to your Supabase project URL. Restart the dev server.
4. **"Server error (404)" or "Network error"** — Deploy the Edge Functions from the Ridely-App folder. App URL must be `https://YOUR_REF.supabase.co/functions/v1`.
5. **"Invalid key"** — You must use the **Secret Key** (starts with `sk_test_` for Test), not the Public Key (`pk_test_`). In Paystack: **Settings → API Keys & Webhooks** → copy the **Secret** key. In Supabase **Edge Functions → Secrets**, set `PAYSTACK_SECRET_KEY` to that value with no extra spaces or quotes. Redeploy: `npx supabase functions deploy paystack-initialize`.
6. **Other Paystack error** — Use the **Test** secret key from Paystack Settings → API Keys (Test mode). For live payments, switch to the **Live** secret key (`sk_live_...`).

---

## 1. Run the migration

In Supabase Dashboard → SQL Editor, run:

**`migrations/20250628000000_payment_methods.sql`**

This creates:

- `payment_methods` table (user_id, type, label, last_four, brand, expiry, gateway_payment_method_id, is_default)
- RLS so users only see/edit their own methods
- Trigger so only one method per user is default

## 2. Customer flow (already in the app)

- **Profile → Payment Methods** lists saved methods from Supabase and lets users set default or remove.
- **Add Payment Method** can add “Cash on Delivery” (stored in Supabase). Card and wallet require a gateway (below).

## 3. Adding real card collection (choose one)

### Option A: Paystack (Nigeria, ₦)

1. Sign up at [Paystack](https://paystack.com) and get **Secret Key** and **Public Key**.
2. Install: `npx expo install react-native-paystack-webview` (or use Paystack’s inline/web SDK).
3. In the app:
   - Create a screen/modal that opens Paystack’s **Card** or **Authorization** flow (see [Paystack Docs – Collect card](https://paystack.com/docs/payments/accept-payments/#collect-card-details)).
   - On success, you receive a **customer code** and/or **authorization code**. Store in your backend or in Supabase via an Edge Function:
     - Call Paystack API to get card last4/brand (or use the response you get).
     - Insert into `payment_methods`: `user_id`, `type: 'card'`, `label`, `last_four`, `brand`, `gateway_payment_method_id` = Paystack auth code, `is_default`.
4. For charges later, use the stored `gateway_payment_method_id` (authorization code) with Paystack’s charge API.

### Option B: Stripe

1. Create a [Stripe](https://stripe.com) account and get **Publishable Key** and **Secret Key**.
2. Install: `npm install @stripe/stripe-react-native` and configure per [Stripe React Native](https://stripe.com/docs/payments/accept-a-payment?platform=react-native).
3. Use **Payment Element** or **Card Field** to collect card details. Stripe returns a **PaymentMethod** id (`pm_xxx`).
4. In a Supabase Edge Function (or your backend):
   - Attach the PaymentMethod to a Stripe Customer (create customer if needed, keyed by `user_id`).
   - From the PaymentMethod you can read `card.last4`, `card.brand`, `card.exp_month`, `card.exp_year`.
   - Insert into `payment_methods`: `user_id`, `type: 'card'`, `label` (e.g. “Visa •••• 4242”), `last_four`, `brand`, `expiry_month`, `expiry_year`, `gateway_payment_method_id` = `pm_xxx`, `is_default`.
5. For charges, create a PaymentIntent with `payment_method: gateway_payment_method_id` and `confirm: true` (server-side).

### Option C: Backend-only (no SDK in app)

- Collect card details on your backend (e.g. Stripe/Paystack server API) and return a token or payment method id.
- Your API then inserts the corresponding row into `payment_methods` (and optionally links it to the gateway customer).

## 4. Wallet balance (optional)

If you add a “Ridely Wallet”:

- Add a `wallet_balance` column to `users` (or a separate `wallets` table keyed by `user_id`).
- When the user “tops up”, charge their card via Stripe/Paystack and credit the balance.
- When they pay with “Ridely Wallet”, deduct from balance and record the transaction.

## 5. Booking/checkout

On the booking confirmation screen, use the default payment method (or the one the user selects):

- **Card**: charge via Stripe/Paystack using `gateway_payment_method_id`.
- **Cash**: no charge; mark order as “pay on delivery”.
- **Wallet**: deduct from wallet and create a transaction record.

The `payment_methods` table and Profile → Payment Methods UI are ready; plug in the gateway of your choice using the steps above.

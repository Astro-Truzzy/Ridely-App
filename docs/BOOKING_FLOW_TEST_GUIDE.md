# End-to-End Booking Flow Test Guide

Step-by-step instructions to test the full flow: **User creates a booking → Rider sees and accepts it → Delivery progresses** so you can confirm everything works together.

---

## Prerequisites

1. **Supabase project** running with migrations applied (including `deliveries`, `riders`, `rider_verification_documents`, `notifications`, RLS, etc.).
2. **Two test accounts** (or two devices / emulator + device):
   - **Account A (Customer):** Signs up as “user” (default) to create bookings.
   - **Account B (Rider):** Signs up as “rider” and is **verified** so they can accept jobs.
3. **Rider verification:** Riders must have `account_verification_status = 'verified'` to accept deliveries. For quick testing you can set this in the database (see [Step 2](#2-set-up-the-rider-account) below).

---

## 1. Set up the customer account (User)

1. Open the app and **log out** if already signed in.
2. Tap **Sign up**.
3. Choose **“Book deliveries”** (customer option), then fill in:
   - Full name  
   - Email  
   - Phone  
   - Password  
4. Complete sign-up and OTP if enabled.
5. You should land on the **Home** tab (customer flow) with options like **Book Delivery**, **Schedule**, **My Bookings**, etc.

**Check:** You can open **Profile** and **My Bookings**; there should be no deliveries yet.

---

## 2. Set up the rider account (Rider)

Riders must exist in the `riders` table and be **verified** to accept jobs.

### Option A: Sign up as a rider in the app

1. Use a **different** email/phone than the customer (or another device).
2. Tap **Sign up**.
3. Choose **“Earn as a rider”** (rider option).
4. Fill in details and complete sign-up.
5. You should land on the **Rider dashboard** (`/(rider)/dashboard`).
6. Go to **Profile → Apply for verification** and submit the required documents (e.g. NIN, guarantor letter, driver’s license).
7. **Verification is manual:** An admin must set the rider as verified in the database (see Option B below), or your app may have an admin panel that does this.

### Option B: Manually verify the rider (for testing)

1. In **Supabase Dashboard → Authentication → Users**, find the rider’s account and copy their **User UUID**.
2. In **SQL Editor**, run (replace `RIDER_USER_UUID` with that UUID):

```sql
UPDATE public.riders
SET account_verification_status = 'verified'
WHERE id = 'RIDER_USER_UUID';
```

3. In the app, **log out** and **log in** again as the rider (or pull-to-refresh if the app refetches profile).
4. The rider can now **accept** jobs from the dashboard.

### Option C: Turn an existing user into a rider (SQL)

If you already have a user and want them to act as a rider:

1. Get their **User UUID** from **Authentication → Users** (must match the auth user who will log in as rider).
2. In **SQL Editor**, run (replace `RIDER_USER_UUID` with that UUID and set email/name/phone to match that user):

```sql
INSERT INTO public.riders (id, email, full_name, phone, vehicle_type, plate_number, rating, is_available, account_verification_status, created_at, updated_at)
VALUES (
  'RIDER_USER_UUID',
  'your@email.com',
  'Your Name',
  '+2348012345678',
  'Motorcycle',
  'ABC-123',
  5.0,
  true,
  'verified',
  now(),
  now()
)
ON CONFLICT (email) DO UPDATE SET
  account_verification_status = 'verified',
  updated_at = now();
```

- If a rider row for that email **already exists** (e.g. created by signup), the `ON CONFLICT (email)` clause updates it to `verified` and you avoid a duplicate-email error.
- If no row exists, a new rider row is inserted with the given `id` (use the **same UUID** as the auth user so the app treats them as a rider).

3. Log out and log in with that account; the app should show the **rider** flow (dashboard with available jobs).

---

## 3. Create a booking (Customer flow)

1. **Log in as the customer** (Account A).
2. From **Home**, tap **Book Delivery**.
3. **Step 1 – Parcel size**  
   - Choose **Small**, **Medium**, or **Large**.  
   - Tap **Continue**.
4. **Step 2 – Addresses**  
   - Enter or select **Pickup address** (e.g. use search or a saved address).  
   - Enter or select **Dropoff address**.  
   - If you chose “Schedule” from Home, set the scheduled date/time.  
   - Tap **Continue** (e.g. to **Pricing**).
5. **Step 3 – Pricing / confirmation**  
   - Review **Booking summary**, price, and distance.  
   - Tap **Confirm Booking** (or equivalent) to go to the confirmation screen.
6. **Step 4 – Confirm & pay**  
   - On the **Confirmation** screen, choose a payment method:
     - **Cash on Delivery** – no Paystack; booking is created immediately when you tap **Confirm Booking**.
     - **Card** – opens Paystack in a WebView; after payment, the app creates the booking (ensure Paystack and Supabase Edge Functions are configured).
     - **Wallet** – uses wallet balance if implemented.
   - Tap **Confirm Booking**:
     - For **Cash**: The delivery is created with status `pending` and you see a success message.
     - For **Card**: Complete payment in the WebView; then the delivery is created and you see success.
7. After success, tap **View Bookings** or go to **My Bookings** and confirm the new delivery appears with status **Pending** (or “Searching for rider…” on Home).

**Check:** On **Home**, you should see the active delivery card with “Searching for rider…” (and optionally a “Cancel” option in My Bookings). Real-time updates may take a moment.

---

## 4. Accept the booking (Rider flow)

1. **Log in as the rider** (Account B) on another device or after switching accounts.
2. Open the **Rider dashboard** (you should see **Available jobs** or similar).
3. **Go online** (if there is an “Online” / “Available” toggle, turn it on and allow location when prompted).
4. You should see the **pending** delivery you just created (pickup, dropoff, amount, parcel size).
5. Tap **Accept** (or “Accept job”) on that delivery.
6. **Expected:**
   - The job disappears from the **Available jobs** list.
   - You are taken to the **Active delivery** screen for that job (with pickup/dropoff and status steps).
7. **Customer side:** The customer’s app (if open or when they refresh) should update: the delivery no longer shows “Searching for rider…” and shows a rider-assigned / in-transit state (exact wording depends on your UI).

**Check:** In **Supabase → Table Editor → deliveries**, that row should have:
- `rider_id` = rider’s user UUID  
- `status` = `accepted` (or next step in your flow).

---

## 5. Progress the delivery (Rider)

From the **Active delivery** screen, the rider typically can move the delivery through stages, for example:

1. **At pickup** – Mark as **Picked up** (status → `picked_up` or `rider_assigned` depending on your schema).
2. **En route** – Mark as **In transit** (status → `in_transit`).
3. **At dropoff** – Mark as **Delivered** (status → `delivered` / `completed`).

**Check:**  
- Rider’s **Earnings** or **Completed** list should show the completed delivery.  
- Customer’s **My Bookings** should show the delivery as **Delivered** (and optionally allow **Rate rider**).

---

## 6. Optional: Test cancellation (no rider accepts)

1. As **customer**, create another booking (e.g. Cash on Delivery) and **do not** accept it as a rider.
2. Leave the delivery in **pending** for at least **2 minutes**.
3. **If the app is open** on the customer’s device: The app may call the **auto-cancel** Edge Function after 2 minutes and the delivery becomes **Cancelled** (e.g. `cancelled_no_rider`).
4. **If you have a cron** (or manually invoke the Edge Function): Run the `auto-cancel-pending-deliveries` function; any pending delivery older than 2 minutes should be set to `cancelled_no_rider` and the user should get a “Delivery cancelled” notification.

**Check:**  
- Delivery status in DB: `cancelled_no_rider`.  
- Customer sees the delivery under **Cancelled** in My Bookings and may see a “Delivery cancelled” notification.

---

## 7. Quick checklist

| Step | Who | Action | What to verify |
|------|-----|--------|----------------|
| 1 | Customer | Sign up (user) | Lands on Home, can open Book Delivery. |
| 2 | Rider | Sign up (rider) + verify | Dashboard shows Available jobs; can accept. |
| 3 | Customer | Book Delivery → Addresses → Pricing → Confirm (e.g. Cash) | Delivery created, status `pending`; appears on Home and My Bookings. |
| 4 | Rider | Accept job from dashboard | Job moves to Active delivery; `rider_id` and `status` updated in DB. |
| 5 | Rider | Mark Picked up → In transit → Delivered | Status updates; customer sees Delivered; rider sees in earnings/completed. |
| 6 | (Optional) | Do not accept a booking; wait 2+ min or trigger auto-cancel | Delivery cancelled; user notified. |

---

## Troubleshooting

- **Rider does not see any jobs**  
  - Confirm the delivery exists in `deliveries` with `status = 'pending'` and `rider_id IS NULL`.  
  - Confirm the rider is **verified** (`account_verification_status = 'verified'`).  
  - Confirm real-time is working (Supabase Realtime for `deliveries` table) or refresh the list.

- **“Only riders can accept” / “You must be verified”**  
  - User must have a row in `riders` and `account_verification_status = 'verified'` (see [Step 2](#2-set-up-the-rider-account)).

- **Customer does not see “Searching for rider” or updates**  
  - Check that the delivery was created (`deliveries` insert succeeded).  
  - Check RLS: customer should read rows where `user_id = auth.uid()`.  
  - If using real-time, ensure the app is subscribed to `deliveries` for `user_id`.

- **Payment (card) then booking**  
  - Ensure Paystack is configured (secret key in Edge Function env).  
  - Ensure the app uses backend initialize + WebView (no inline popup).  
  - After payment success, the confirmation screen should call `createDelivery`; check for errors in the app or network tab.

- **Auto-cancel not running**  
  - Deploy the `auto-cancel-pending-deliveries` Edge Function.  
  - Either keep the customer app open for 2 minutes (app-triggered) or set up a cron / manual invoke (see `docs/AUTO_CANCEL_CRON.md`).

---

## References

- **Test data (seed):** `docs/TEST_DATA_SEED.md` – sample deliveries and test rider for tracking/map.
- **Auto-cancel:** `docs/AUTO_CANCEL_CRON.md` – scheduling the pending-delivery auto-cancel.
- **Paystack:** `docs/PAYSTACK_IMPLEMENTATION_SPEC.md` – payment and wallet integration.

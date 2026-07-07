# Test Data for Ridely

Use this to get sample deliveries, an active delivery for tracking/maps, and notifications.

## Option A: Run SQL in Supabase (recommended)

1. **Get your user ID**
   - Supabase Dashboard → **Authentication** → **Users**
   - Copy the **UUID** of the user you use to log in (e.g. `a1b2c3d4-e5f6-4789-a012-345678901234`)

2. **Edit the seed file**
   - Open `supabase/seed_test_data.sql`
   - Replace every `'YOUR_USER_ID'` with your UUID (keep the single quotes), e.g. `'a1b2c3d4-e5f6-4789-a012-345678901234'`

3. **Run the script**
   - Supabase Dashboard → **SQL Editor** → New query
   - Paste the full contents of `seed_test_data.sql`
   - Click **Run**

4. **What you get**
   - **Test rider** (used for active delivery and map)
   - **Rider location** in Lagos (6.5244, 3.3792) so the tracking map shows a pin
   - **1 active delivery** (in_transit) – use this to open **Tracking** and see the map
   - **1 pending delivery** – use **My Bookings** → Cancel delivery
   - **2 delivered** – Home “recent deliveries” and My Bookings → Completed
   - **1 cancelled** – My Bookings → Cancelled
   - **2 notifications** – Notifications screen

## Option B: In-app seed (after Option A)

If you already ran the SQL once (so the test rider exists), you can add more test deliveries from the app:

1. Go to **Profile** or **Settings**
2. Scroll to **Development** → tap **Seed test data**
3. This creates extra deliveries for the **current user** only; it does not create riders or rider locations.

(If you add a “Seed test data” button in the app, it should call the same logic as in the SQL: insert deliveries for `auth.uid()` with the test rider ID `a1b2c3d4-e5f6-4789-a012-345678901234` where needed.)

## What to test

| Feature            | How to test                                                                 |
|--------------------|-----------------------------------------------------------------------------|
| **Tracking + map** | Home → tap active delivery, or My Bookings → tap the “in transit” delivery  |
| **Cancel pending** | My Bookings → find “Pending” → Cancel delivery                              |
| **Recent deliveries** | Home → scroll to “Recent deliveries”                                    |
| **Tabs (All/Active/Completed/Cancelled)** | My Bookings → switch tabs              |
| **Notifications**  | Notifications tab                                                          |

## How to test as a rider

The app uses **role = rider** when your user has a row in the `riders` table. To use the rider flow (dashboard, active delivery, job details, etc.):

### Option 1: Sign up as a rider (recommended)

1. Open the app and go to **Sign up**.
2. On the sign-up screen, tap **“Earn as a rider”** (the rider option).
3. Fill in name, email, phone, password and complete sign-up.
4. After sign-up you are taken to the **Rider dashboard** (`/(rider)/dashboard`).
5. From there you can open **Available jobs**, **Active delivery**, **Profile**, **Earnings**, etc.

To test rider + customer in parallel, use two accounts: one signed up as “user” (customer) and one as “rider”.

### Option 2: Turn an existing account into a rider (SQL)

If you already have a customer account and want to use it as a rider:

1. In Supabase go to **Authentication → Users** and copy your account’s **User UUID**.
2. In **SQL Editor** run:

```sql
INSERT INTO public.riders (id, email, full_name, phone, vehicle_type, plate_number, rating, is_available, created_at, updated_at)
VALUES (
  'YOUR_USER_UUID_HERE',
  'your@email.com',
  'Your Name',
  '+2348012345678',
  'Motorcycle',
  'ABC-123',
  5.0,
  true,
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET updated_at = now();
```

Replace `YOUR_USER_UUID_HERE` and the email/name/phone with your real data.

3. **Log out** in the app, then **log in** again. The app checks the `riders` table first; if it finds your user ID there, it sets `userType = 'rider'` and redirects to the rider dashboard.

Note: The test rider in the seed (`a1b2c3d4-e5f6-4789-a012-345678901234`) is only for **customer** testing (deliveries assigned to that rider so the tracking map shows a rider pin). There is no auth user for that ID, so you cannot log in as that test rider.

---

## Resetting test data

- To remove only deliveries for your user, run in SQL Editor (replace with your user ID):

```sql
DELETE FROM public.deliveries WHERE user_id = 'YOUR_USER_ID';
```

- To remove the test rider and all related data:

```sql
DELETE FROM public.rider_locations WHERE rider_id = 'a1b2c3d4-e5f6-4789-a012-345678901234';
DELETE FROM public.deliveries WHERE rider_id = 'a1b2c3d4-e5f6-4789-a012-345678901234';
DELETE FROM public.riders WHERE id = 'a1b2c3d4-e5f6-4789-a012-345678901234';
```

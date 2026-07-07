# Ridely Supabase migrations

## New database (recommended)

For a **new** Supabase project, run **one file** in the SQL Editor:

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Copy the full contents of:
   - **`migrations/20250618000000_ridely_initial_schema.sql`**
3. Paste into a new query and click **Run**.

This creates:

- Enums, tables (`users`, `riders`, `rider_locations`, `deliveries`, `earnings`, `notifications`)
- RLS and policies (including riders claiming pending deliveries; users can read rider location only for their active delivery)
- Realtime for **`rider_locations`** so customers see the rider’s location live on the tracking screen
- Indexes, `updated_at` triggers, `calculate_earnings` trigger, auth `handle_new_user` triggers

**If signup fails with "Database error updating user"**, run **`20250632000000_handle_new_user_defensive.sql`** so the auth trigger never fails the signup; the app will create the profile after signup.

## Custom Access Token hook (optional, for role in JWT)

To put the user role (`user_type`: `user` | `rider`) in the JWT so the app can redirect without a DB hit on load:

1. Run the migration **`20250618100000_custom_access_token_hook_user_type.sql`** in the SQL Editor (after the initial schema).
2. In Supabase Dashboard go to **Authentication → Hooks**.
3. Under **Custom Access Token**, choose **Postgres Function** and select **`public.custom_access_token_hook`**.
4. Save. New sign-ins and token refreshes will include `app_metadata.user_type` in the JWT.

The app already reads `session.user.app_metadata.user_type` when present and uses it for immediate redirect; otherwise it falls back to loading the profile from the database.

## Rider verification (required for riders to accept deliveries)

Run **`migrations/20250627000000_rider_verification.sql`** in the SQL Editor to add:

- `riders.account_verification_status` (`not_submitted` | `pending` | `verified` | `rejected`)
- Table `rider_verification_documents` for NIN, guarantor letter, driver's license, etc.
- Storage bucket `rider-verification-docs` and RLS so riders can upload only to their own folder

After this migration, riders must apply for verification (upload documents) and be approved before they can accept delivery requests. Admins can approve/reject later via the admin dashboard using the same table and storage.

## Realtime (rider location)

Live rider location is **included** in the initial schema: `rider_locations` is added to the `supabase_realtime` publication. Customers see the rider’s position on the Track Delivery screen in real time.

If you created your database before this was added, enable it manually: Dashboard → **Database** → **Replication** → add `rider_locations`, or run:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.rider_locations;
```

## PostGIS security (Security Advisor: RLS on spatial_ref_sys)

If the Supabase **Security Advisor** reports **RLS Disabled in Public** on `public.spatial_ref_sys`, run:

**`migrations/20250638000000_postgis_spatial_ref_sys_rls.sql`**

This enables RLS on PostGIS’s catalog table and revokes `anon` / `authenticated` access. Ridely never queries this table via the API; only internal `ST_*` functions use it.

For **new** databases, the PostGIS migration (`20250625000000_postgis_and_delivery_flow.sql`) installs the extension in the `extensions` schema so `spatial_ref_sys` is not exposed in `public`.


## Saved addresses (optional)

Run **`migrations/20250629000000_saved_addresses.sql`** in the SQL Editor to add:

- Table **`saved_addresses`** (user_id, label, address, latitude, longitude) so customers can save Home, Work, etc. and use them when booking. Profile → Saved Addresses and the booking address screen use this table.

## Delivery ratings (optional)

Run **`migrations/20250630000000_delivery_ratings.sql`** in the SQL Editor to add:

- Table **`delivery_ratings`** (delivery_id, user_id, rider_id, rating 1–5, review_text) so users can rate and optionally review after a delivery. One rating per delivery. A trigger updates the rider’s average **`riders.rating`** when a new rating is inserted. My Bookings → completed deliveries show “Rate & Review” until the user has rated.

## Avatars bucket (optional)

Run **`migrations/20250631000000_avatars_bucket.sql`** in the SQL Editor to add:

- Storage bucket **`avatars`** (public, 2MB limit, images only) for profile pictures. Authenticated users can upload/update their own file at `{user_id}/avatar.{ext}`. Profile → tap avatar → Camera or Gallery uses this bucket and updates **`users.avatar_url`** or **`riders.avatar_url`**.

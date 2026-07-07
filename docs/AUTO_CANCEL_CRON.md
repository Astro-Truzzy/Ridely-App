# Auto-cancel pending deliveries (Edge Function + cron)

If a delivery stays in `pending` for more than 2 minutes with no rider assigned, it is automatically set to `cancelled_no_rider` and the user receives a notification.

**App-triggered cancel:** When the user has the app open (Home or Tracking screen) and is seeing "Searching for rider…", the app calls this Edge Function after 2 minutes so the delivery is cancelled even if no external cron is set up. For deliveries that happen while the app is closed, you still need a cron (see below).

## Edge Function

- **Name:** `auto-cancel-pending-deliveries`
- **Path:** `supabase/functions/auto-cancel-pending-deliveries/index.ts`
- **Behavior:**  
  - Selects `deliveries` where `status = 'pending'` and `created_at < now() - 2 minutes`.  
  - Updates their `status` to `cancelled_no_rider`.  
  - Inserts a `notifications` row for each affected user (type `system`, title "Delivery cancelled").

## Deploy the function

```bash
supabase functions deploy auto-cancel-pending-deliveries
```

Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in the project (Supabase sets these for deployed functions).

## Invoke on a schedule (cron)

Run the function every 1–2 minutes so pending deliveries are cancelled soon after the 2‑minute window.

### Option A: Supabase cron (pg_cron)

If your project has pg_cron and `pg_net` (or an HTTP-calling extension), you can schedule from SQL:

**Enabling pg_cron:** In the Dashboard (Database → Extensions), when enabling pg_cron, use schema **`extensions`** if prompted. Or run in the SQL Editor:

```sql
create extension if not exists pg_cron with schema extensions;
```

1. Get your function URL:  
   `https://<project-ref>.supabase.co/functions/v1/auto-cancel-pending-deliveries`
2. In **SQL Editor**, create a cron job that calls this URL (syntax depends on your setup; see Supabase docs for “scheduled functions” or “cron”).

### Option B: External cron

Use any cron service (e.g. GitHub Actions, cron job on a server) to send a POST request every 1–2 minutes:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/auto-cancel-pending-deliveries" \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"
```

Replace `<project-ref>` and the Bearer token with your project’s values. This endpoint now enforces auth: use **service role key** for cron/global cancels.

### Option C: Supabase Cron (Scheduled Functions via Dashboard)

Use the **Cron** integration in the dashboard to run `auto-cancel-pending-deliveries` on a schedule—no SQL or external cron needed.

**1. Prerequisites**

- **pg_cron**: Database → Extensions → enable **pg_cron** (use schema `extensions` if prompted).
- **pg_net** (for calling Edge Functions): Database → Extensions → enable **pg_net** (schema `extensions` if prompted).
- **Edge Function deployed**: Run `supabase functions deploy auto-cancel-pending-deliveries` so the function exists in your project.

**2. Open Cron**

- In the [Supabase Dashboard](https://supabase.com/dashboard), go to **Integrations** (left sidebar).
- Open **Cron** (or “Cron Postgres Module”).
- Go to **Jobs** and click **Create job** (or use the “New cron job” form).

**3. Create the scheduled job**

- **Job type**: Choose **HTTP request** or **Supabase Edge Function** (if your project shows that option).
- **Function / URL**:  
  - If “Supabase Edge Function”: select `auto-cancel-pending-deliveries`.  
  - If “HTTP request”: set URL to  
    `https://<project-ref>.supabase.co/functions/v1/auto-cancel-pending-deliveries`  
    and add a header (use the two fields):  
    - **Header name:** `Authorization`  
    - **Header value:** `Bearer <YOUR_SERVICE_ROLE_KEY>`  
    (Replace `<YOUR_SERVICE_ROLE_KEY>` with your service role key from Dashboard → Project Settings → API. Keep it secret.)
- **Schedule**: Every 1–2 minutes, e.g. `* * * * *` (every minute) or `*/2 * * * *` (every 2 minutes). You can also use natural language like “every 1 minute” if the UI supports it.
- **Name**: e.g. `auto-cancel-pending-deliveries`.
- Save / **Create job**.

**4. Verify**

- In **Jobs**, confirm the new job is **Active**.
- Use **History** next to the job to see runs and any errors.
- Test by creating a `pending` delivery, waiting 2+ minutes, then checking that it was set to `cancelled_no_rider` and that a “Delivery cancelled” notification was created.

## Testing

1. Create a delivery (status `pending`) and do not assign a rider.
2. Wait at least 2 minutes (or temporarily change the interval in the function for testing).
3. Trigger the function (e.g. `curl` or “Invoke” in the dashboard).
4. Confirm the delivery’s status is `cancelled_no_rider` and the user has a “Delivery cancelled” notification.



/**
 * Two-account booking-loop smoke test against the linked Supabase project.
 * Uses the Management API (SUPABASE_ACCESS_TOKEN) plus an unauthenticated
 * create-delivery probe. Does not print secrets.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_REF = 'ihvuufwbbuiafmxzkdui';

function loadEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).replace(/^['"]|['"]$/g, '');
  }
  return env;
}

const env = { ...loadEnv(path.join(root, '.env')), ...process.env };

async function managementQuery(sql) {
  const token = env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN missing from .env');
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SQL ${res.status}: ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function probeCreateDelivery() {
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase public URL/anon key missing');
  const res = await fetch(`${url.replace(/\/$/, '')}/functions/v1/create-delivery`, {
    method: 'POST',
    headers: {
      apikey: anon,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ payment_method: 'cash' }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, error: body.error || body.msg || body.message || null };
}

async function main() {
  console.log('[smoke] 1/3 Probe deployed create-delivery (expect auth rejection)');
  const probe = await probeCreateDelivery();
  if (probe.status === 401 || probe.status === 403) {
    console.log(`  ok  HTTP ${probe.status} — ${probe.error || 'unauthorized'}`);
  } else if (probe.status === 200) {
    throw new Error('create-delivery allowed an unauthenticated request');
  } else {
    console.log(`  ok  HTTP ${probe.status} — ${probe.error || 'rejected'}`);
  }

  console.log('[smoke] 2/3 Resolve a customer + verified rider');
  const accounts = await managementQuery(`
    SELECT
      (SELECT id FROM public.users ORDER BY created_at DESC LIMIT 1) AS customer_id,
      (SELECT id FROM public.riders
        WHERE account_verification_status = 'verified'
        ORDER BY created_at DESC LIMIT 1) AS rider_id;
  `);
  const row = Array.isArray(accounts) ? accounts[0] : accounts;
  const customerId = row?.customer_id;
  const riderId = row?.rider_id;
  if (!customerId || !riderId) {
    throw new Error(
      `Need both a customer and a verified rider in the database (customer=${!!customerId}, rider=${!!riderId}). Sign up those two accounts in the app, then re-run.`
    );
  }
  if (customerId === riderId) {
    throw new Error('Customer and rider resolved to the same id — need two distinct accounts.');
  }
  console.log(`  ok  customer ${customerId.slice(0, 8)}…  rider ${riderId.slice(0, 8)}…`);

  console.log('[smoke] 3/3 Customer booking → rider accept → pickup → cancel cleanup');
  const result = await managementQuery(`
    DO $$
    DECLARE
      v_delivery_id uuid;
      v_accepted public.deliveries;
      v_picked integer;
    BEGIN
      INSERT INTO public.deliveries (
        user_id, pickup_address, dropoff_address,
        pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
        parcel_size, status, total_cost, distance, estimated_time,
        delivery_time, payment_method, payment_status
      ) VALUES (
        '${customerId}',
        'QA smoke pickup, Lagos',
        'QA smoke dropoff, Lagos',
        6.5244, 3.3792, 6.4281, 3.4219,
        'small', 'pending', 500, 2, '10 mins',
        'now', 'cash', 'unpaid'
      )
      RETURNING id INTO v_delivery_id;

      PERFORM set_config('request.jwt.claim.sub', '${riderId}', true);
      PERFORM set_config(
        'request.jwt.claims',
        json_build_object('sub', '${riderId}', 'role', 'authenticated')::text,
        true
      );

      v_accepted := public.accept_delivery(v_delivery_id);
      IF v_accepted.rider_id IS DISTINCT FROM '${riderId}'::uuid
         OR v_accepted.status IS DISTINCT FROM 'accepted' THEN
        RAISE EXCEPTION 'accept_delivery failed: rider=% status=%',
          v_accepted.rider_id, v_accepted.status;
      END IF;

      PERFORM set_config('ridely.internal_delivery_update', 'on', true);
      UPDATE public.deliveries
      SET status = 'picked_up', updated_at = now()
      WHERE id = v_delivery_id
        AND status = 'accepted'
        AND rider_id = '${riderId}'::uuid;
      GET DIAGNOSTICS v_picked = ROW_COUNT;
      IF v_picked <> 1 THEN
        RAISE EXCEPTION 'pickup update failed for %', v_delivery_id;
      END IF;

      UPDATE public.deliveries
      SET status = 'cancelled', updated_at = now()
      WHERE id = v_delivery_id;

      PERFORM set_config('ridely.internal_delivery_update', 'off', true);
      UPDATE public.riders
      SET is_available = true, updated_at = now()
      WHERE id = '${riderId}'::uuid;

      RAISE NOTICE 'SMOKE_DELIVERY=%', v_delivery_id;
    END $$;
  `);
  console.log('  ok  booking accepted, picked up, then cancelled (cleanup)');
  if (result) {
    const notice = JSON.stringify(result).slice(0, 300);
    if (notice && notice !== '[]' && notice !== 'null') {
      console.log('  db:', notice);
    }
  }
  console.log('[smoke] Two-account booking loop passed.');
}

main().catch((err) => {
  console.error('[smoke] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});

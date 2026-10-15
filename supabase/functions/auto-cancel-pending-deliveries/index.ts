/// <reference path="./deno.d.ts" />
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  STALE_MS,
  cancellationKind,
  type CancellationCandidate,
} from '../_shared/cancellation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PendingDelivery = CancellationCandidate;

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return jsonResponse({ error: 'Server misconfiguration' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const token = authHeader.slice('Bearer '.length);
    const isServiceCaller = token === supabaseServiceKey;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let actorUserId: string | null = null;
    if (!isServiceCaller) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await authClient.auth.getUser(token);
      if (error || !data.user) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
      actorUserId = data.user.id;
    }

    const twoMinutesAgo = new Date(Date.now() - STALE_MS).toISOString();
    const nowMs = Date.now();
    let pending: PendingDelivery[] = [];
    let expiring: PendingDelivery[] = [];
    if (isServiceCaller) {
      const { data, error } = await supabase
        .from('deliveries')
        .select('id, user_id, payment_status, created_at')
        .eq('status', 'pending')
        .is('rider_id', null)
        .lt('created_at', twoMinutesAgo);
      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }
      for (const row of ((data ?? []) as PendingDelivery[])) {
        const kind = cancellationKind(row, nowMs);
        if (kind === 'cancel' || kind === 'expire') pending.push(row);
        if (kind === 'expire') expiring.push(row);
      }
    } else if (actorUserId) {
      const body = (await req.json().catch(() => ({}))) as { delivery_id?: string };
      const deliveryId = body.delivery_id;
      if (!deliveryId) {
        return jsonResponse({ error: 'delivery_id is required for authenticated calls' }, 400);
      }
      const { data, error } = await supabase
        .from('deliveries')
        .select('id, user_id, payment_status, created_at')
        .eq('id', deliveryId)
        .eq('user_id', actorUserId)
        .eq('status', 'pending')
        .is('rider_id', null)
        .lt('created_at', twoMinutesAgo);
      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }
      const row = ((data ?? []) as PendingDelivery[])[0];
      if (row) {
        const kind = cancellationKind(row, nowMs);
        if (kind === 'cancel' || kind === 'expire') pending.push(row);
        if (kind === 'expire') expiring.push(row);
      }
    }

    if (!pending?.length) {
      return jsonResponse({ cancelled: 0, message: 'No stale pending deliveries' });
    }

    const ids = pending.map((d) => d.id);
    const { error: updateError } = await supabase
      .from('deliveries')
      .update({ status: 'cancelled_no_rider' })
      .in('id', ids);

    if (updateError) {
      console.error('auto-cancel update error', updateError);
      return jsonResponse({ error: updateError.message }, 500);
    }

    // Expired transfer checkouts: close the payments row so late money lands in
    // the webhook exception path instead of dispatching a cancelled delivery.
    if (expiring.length > 0) {
      const { error: expireError } = await supabase
        .from('payments')
        .update({
          status: 'expired',
          failure_reason: 'Transfer not completed within 30 minutes',
          updated_at: new Date().toISOString(),
        })
        .in(
          'delivery_id',
          expiring.map((d) => d.id)
        )
        .eq('status', 'pending');
      if (expireError) {
        console.error('auto-cancel payments expiry error', expireError);
      }
    }

    const pushTitle = 'Delivery cancelled';
    const pushBody = 'No rider was available. Your delivery has been cancelled. You can book again.';

    for (const row of pending) {
      await supabase.from('notifications').insert({
        user_id: row.user_id,
        type: 'system',
        title: pushTitle,
        message: pushBody,
        read: false,
        actionable: true,
      });
    }

    // Send push notifications to affected users
    const userIds = [...new Set(pending.map((r) => r.user_id))];
    if (userIds.length > 0) {
      try {
        const pushRes = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            userIds,
            title: pushTitle,
            body: pushBody,
            data: { type: 'system' },
          }),
        });
        if (!pushRes.ok) {
          console.error('auto-cancel: send-push failed', pushRes.status, await pushRes.text());
        }
      } catch (e) {
        console.error('auto-cancel: send-push error', e);
      }
    }

    return jsonResponse({ cancelled: ids.length, ids });
  } catch (err) {
    console.error('auto-cancel error', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});

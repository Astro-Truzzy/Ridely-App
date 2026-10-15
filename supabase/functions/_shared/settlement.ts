// Shared settlement helpers: Lagos slot computation + deterministic payout
// references. Pure functions, unit-tested.
//
// Africa/Lagos is UTC+1 with no DST, so the twice-daily cutoffs map to fixed
// UTC cron times: 00:00 WAT = 23:00 UTC, 18:00 WAT = 17:00 UTC. These helpers
// derive the batch identity from a timestamp; the schedule itself lives in
// supabase/scheduler/payout_settlement.sql (manual deploy step).

export type SettlementSlot = '00:00' | '18:00';

/** Minimum per-rider payout: below this, earnings carry forward (kobo). */
export const MIN_PAYOUT_KOBO = 5000; // ₦50

/**
 * Derive the Lagos business date + settlement slot for a timestamp.
 * Runs before 12:00 Lagos belong to the 00:00 batch, later runs to 18:00.
 */
export function lagosSlotFor(at: Date): {
  lagosDate: string;
  slot: SettlementSlot;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const lagosDate = `${get('year')}-${get('month')}-${get('day')}`;
  const hour = Number(get('hour')) % 24;
  return { lagosDate, slot: hour < 12 ? '00:00' : '18:00' };
}

/** Batch idempotency key: one batch per Lagos date + slot. */
export function batchIdempotencyKey(lagosDate: string, slot: SettlementSlot): string {
  return `${lagosDate}_${slot}`;
}

/**
 * Deterministic per-rider payout reference inside a batch. Stable across
 * retried scheduler runs so a rerun finds (never duplicates) the payout row.
 */
export function payoutReference(batchId: string, riderId: string): string {
  const short = (id: string) => id.replace(/-/g, '').slice(0, 12);
  return `pb_${short(batchId)}_${short(riderId)}`;
}

// Shared auto-cancel classification (Phase 4: payment-before-dispatch).
// Pure function so the cancellation policy is unit-testable.

/** A pending, unassigned delivery candidate for cancellation. */
export interface CancellationCandidate {
  id: string;
  user_id: string;
  payment_status: string | null;
  created_at: string;
}

/**
 * Stale paid/failed/legacy bookings cancel this long after creation. Rider
 * search starts only after backend-verified payment, so only paid bookings
 * count toward the no-rider window.
 */
export const STALE_MS = 5 * 60 * 1000;
/** Bank-transfer bookings get this grace window for the bank-app round-trip. */
export const TRANSFER_GRACE_MS = 30 * 60 * 1000;

export type CancellationKind = 'cancel' | 'expire' | 'keep';

/**
 * - Paid-but-unclaimed, failed, and legacy unpaid (cash) deliveries: 'cancel'
 *   once stale.
 * - Transfer-pending deliveries: 'keep' inside the grace window, 'expire'
 *   (cancel + close the payments row) afterwards.
 */
export function cancellationKind(
  row: CancellationCandidate,
  nowMs: number
): CancellationKind {
  const ageMs = nowMs - new Date(row.created_at).getTime();
  if (row.payment_status === 'pending') {
    return ageMs >= TRANSFER_GRACE_MS ? 'expire' : 'keep';
  }
  return ageMs >= STALE_MS ? 'cancel' : 'keep';
}

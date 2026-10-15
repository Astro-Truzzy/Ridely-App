import {
  STALE_MS,
  TRANSFER_GRACE_MS,
  cancellationKind,
  type CancellationCandidate,
} from './cancellation.ts';
import { assertEquals } from 'jsr:@std/assert@1';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const row = (
  payment_status: string | null,
  msAgo: number
): CancellationCandidate => ({
  id: 'd1',
  user_id: 'u1',
  payment_status,
  created_at: iso(msAgo),
});

Deno.test('paid-but-unclaimed bookings cancel once stale, kept when fresh', () => {
  assertEquals(cancellationKind(row('paid', STALE_MS + 1000), NOW), 'cancel');
  assertEquals(cancellationKind(row('paid', STALE_MS - 1000), NOW), 'keep');
});

Deno.test('failed and legacy unpaid bookings cancel once stale', () => {
  assertEquals(cancellationKind(row('failed', STALE_MS + 1000), NOW), 'cancel');
  assertEquals(cancellationKind(row('unpaid', STALE_MS + 1000), NOW), 'cancel');
});

Deno.test('transfer-pending bookings are kept inside the grace window', () => {
  assertEquals(cancellationKind(row('pending', 60 * 1000), NOW), 'keep');
  assertEquals(
    cancellationKind(row('pending', TRANSFER_GRACE_MS - 1000), NOW),
    'keep'
  );
});

Deno.test('transfer-pending bookings expire after the grace window', () => {
  assertEquals(
    cancellationKind(row('pending', TRANSFER_GRACE_MS + 1000), NOW),
    'expire'
  );
});

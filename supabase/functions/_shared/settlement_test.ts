import {
  MIN_PAYOUT_KOBO,
  batchIdempotencyKey,
  lagosSlotFor,
  payoutReference,
} from './settlement.ts';
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1';

Deno.test('midnight UTC run belongs to the new Lagos day 00:00 slot', () => {
  // 2026-10-15T23:30:00Z = 00:30 WAT on Oct 16.
  const { lagosDate, slot } = lagosSlotFor(new Date('2026-10-15T23:30:00Z'));
  assertEquals(lagosDate, '2026-10-16');
  assertEquals(slot, '00:00');
});

Deno.test('17:00 UTC run belongs to the 18:00 Lagos slot', () => {
  const { lagosDate, slot } = lagosSlotFor(new Date('2026-10-15T17:30:00Z'));
  assertEquals(lagosDate, '2026-10-15');
  assertEquals(slot, '18:00');
});

Deno.test('morning Lagos runs belong to the 00:00 slot', () => {
  const { slot } = lagosSlotFor(new Date('2026-10-15T10:00:00Z')); // 11:00 WAT
  assertEquals(slot, '00:00');
});

Deno.test('batch idempotency key is date + slot', () => {
  assertEquals(batchIdempotencyKey('2026-10-16', '00:00'), '2026-10-16_00:00');
});

Deno.test('payout references are deterministic and unique per rider', () => {
  const batchId = '123e4567-e89b-12d3-a456-426614174000';
  const a = payoutReference(batchId, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  const b = payoutReference(batchId, 'ffffffff-0000-1111-2222-333333333333');
  assertEquals(a, payoutReference(batchId, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'));
  assertMatch(a, /^pb_[0-9a-f]{12}_[0-9a-f]{12}$/);
  assert(a !== b, 'expected distinct references per rider');
});

Deno.test('minimum payout is ₦50 in kobo', () => {
  assertEquals(MIN_PAYOUT_KOBO, 5000);
});

import {
  ALLOWED_CHECKOUT_CHANNELS,
  buildInternalReference,
  normalizeIdempotencyKey,
  resolveCheckoutChannels,
} from './checkout.ts';
import { assert, assertEquals, assertMatch, assertThrows } from 'jsr:@std/assert@1';

Deno.test('resolveCheckoutChannels defaults to card-only', () => {
  assertEquals(resolveCheckoutChannels(undefined), ['card']);
  assertEquals(resolveCheckoutChannels([]), ['card']);
  assertEquals(resolveCheckoutChannels(['usdc', 'qr']), ['card']);
});

Deno.test('resolveCheckoutChannels allows card + bank_transfer', () => {
  assertEquals(resolveCheckoutChannels(['card', 'bank_transfer']), [
    'card',
    'bank_transfer',
  ]);
  assertEquals(resolveCheckoutChannels(['bank_transfer', 'bank_transfer']), [
    'bank_transfer',
  ]);
});

Deno.test('resolveCheckoutChannels rejects unsupported channels', () => {
  assertEquals(resolveCheckoutChannels(['card', 'ussd']), ['card']);
  assertEquals(
    ALLOWED_CHECKOUT_CHANNELS.includes('ussd' as never),
    false
  );
});

Deno.test('normalizeIdempotencyKey accepts valid keys, null when absent', () => {
  assertEquals(normalizeIdempotencyKey(undefined), null);
  assertEquals(normalizeIdempotencyKey('  '), null);
  assertEquals(normalizeIdempotencyKey('abc12345'), 'abc12345');
});

Deno.test('normalizeIdempotencyKey rejects bad format', () => {
  assertThrows(() => normalizeIdempotencyKey('short'), Error);
  assertThrows(() => normalizeIdempotencyKey('has space here!'), Error);
});

Deno.test('buildInternalReference uses the idempotency key when given', () => {
  assertEquals(buildInternalReference('abc12345'), 'RDL-abc12345');
});

Deno.test('buildInternalReference generates unique RDL refs', () => {
  const a = buildInternalReference(null);
  const b = buildInternalReference(null);
  assertMatch(a, /^RDL-[0-9A-Z]+$/);
  assert(a !== b, 'expected distinct references');
});

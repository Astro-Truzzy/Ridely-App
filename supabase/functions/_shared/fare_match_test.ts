import { assertEquals } from 'jsr:@std/assert@1';
import { computeFareFromDistanceKm, nairaToKobo } from './pricing.ts';

Deno.test('card payment kobo must equal server fare', () => {
  const { totalCost } = computeFareFromDistanceKm(3.5);
  const expectedKobo = nairaToKobo(totalCost);
  const clientTamperedKobo = nairaToKobo(100);
  assertEquals(expectedKobo === clientTamperedKobo, false);
  assertEquals(expectedKobo, 87500);
});

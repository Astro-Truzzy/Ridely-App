import { assertEquals } from 'jsr:@std/assert@1';
import {
  computeFareFromDistanceKm,
  nairaToKobo,
  cardPaymentMatchesQuote,
} from './pricing.ts';

Deno.test('card payment kobo must equal server fare', () => {
  const { totalCost } = computeFareFromDistanceKm(3.5);
  const expectedKobo = nairaToKobo(totalCost);
  const clientTamperedKobo = nairaToKobo(100);
  assertEquals(expectedKobo === clientTamperedKobo, false);
  assertEquals(expectedKobo, 87500);
});

Deno.test('quoted card payment may drift from server fare within tolerance', () => {
  const serverKobo = nairaToKobo(1000);
  assertEquals(
    cardPaymentMatchesQuote({
      paidKobo: nairaToKobo(1100),
      serverKobo,
      quotedKobo: nairaToKobo(1100),
    }),
    true
  );
  assertEquals(
    cardPaymentMatchesQuote({
      paidKobo: nairaToKobo(100),
      serverKobo,
      quotedKobo: nairaToKobo(100),
    }),
    false
  );
});

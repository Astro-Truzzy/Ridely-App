import { assertEquals } from 'jsr:@std/assert@1';
import {
  computeFareFromDistanceKm,
  nairaToKobo,
  cardPaymentMatchesQuote,
  fareQuoteWithinServerBand,
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

Deno.test('fareQuoteWithinServerBand trusts a quote inside the drift band', () => {
  const serverKobo = nairaToKobo(1000);
  // Road-distance quote legitimately above the straight-line server estimate.
  assertEquals(fareQuoteWithinServerBand(nairaToKobo(1150), serverKobo), true);
  assertEquals(fareQuoteWithinServerBand(nairaToKobo(1200), serverKobo), true);
  // Beyond the band — not trusted, server figure is used instead.
  assertEquals(fareQuoteWithinServerBand(nairaToKobo(1300), serverKobo), false);
  // Small fares still get a ±₦100 floor.
  const smallServer = nairaToKobo(200);
  assertEquals(fareQuoteWithinServerBand(nairaToKobo(280), smallServer), true);
  assertEquals(fareQuoteWithinServerBand(nairaToKobo(320), smallServer), false);
});

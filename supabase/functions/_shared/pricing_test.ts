import {
  PRICE_PER_KM,
  computeFareFromDistanceKm,
  estimateRoadDistanceKm,
  nairaToKobo,
} from './pricing.ts';
import { assertEquals, assertThrows } from 'jsr:@std/assert@1';

Deno.test('PRICE_PER_KM is 250', () => {
  assertEquals(PRICE_PER_KM, 250);
});

Deno.test('computeFareFromDistanceKm matches client formula', () => {
  const fare = computeFareFromDistanceKm(2);
  assertEquals(fare.totalCost, 500);
  assertEquals(fare.distanceKm, 2);
});

Deno.test('nairaToKobo matches Paystack amount check', () => {
  assertEquals(nairaToKobo(500), 50000);
  const serverTotal = computeFareFromDistanceKm(1.234).totalCost;
  assertEquals(nairaToKobo(serverTotal), Math.round(serverTotal * 100));
});

Deno.test('invalid distance throws', () => {
  assertThrows(() => computeFareFromDistanceKm(-1));
});

Deno.test('haversine fallback is positive', () => {
  const km = estimateRoadDistanceKm(6.5244, 3.3792, 6.4281, 3.4219);
  assertEquals(km > 0, true);
});

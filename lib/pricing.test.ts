import {
  PRICE_PER_KM,
  HAVERSINE_ROAD_FACTOR,
  computeFareFromDistanceKm,
  estimateRoadDistanceKm,
  haversineKm,
  nairaToKobo,
  cardPaymentMatchesQuote,
  fareQuoteWithinServerBand,
} from './pricing';

describe('pricing', () => {
  it('uses ₦300 per km', () => {
    expect(PRICE_PER_KM).toBe(300);
    expect(computeFareFromDistanceKm(2).totalCost).toBe(600);
    expect(computeFareFromDistanceKm(2).distanceKm).toBe(2);
  });

  it('rounds fare to 2 decimal places', () => {
    expect(computeFareFromDistanceKm(1.234).totalCost).toBe(370.2);
  });

  it('rejects invalid distance', () => {
    expect(() => computeFareFromDistanceKm(-1)).toThrow('Invalid distance');
  });

  it('matches Paystack kobo conversion', () => {
    expect(nairaToKobo(500)).toBe(50000);
    expect(nairaToKobo(308.5)).toBe(30850);
  });

  it('estimates road distance with 1.4 haversine factor', () => {
    const straight = haversineKm(6.5244, 3.3792, 6.4281, 3.4219);
    const road = estimateRoadDistanceKm(6.5244, 3.3792, 6.4281, 3.4219);
    expect(HAVERSINE_ROAD_FACTOR).toBe(1.4);
    expect(road).toBeCloseTo(straight * 1.4, 5);
  });

  it('accepts quoted card payments within route jitter', () => {
    const server = nairaToKobo(1000);
    expect(
      cardPaymentMatchesQuote({ paidKobo: nairaToKobo(1000), serverKobo: server, quotedKobo: nairaToKobo(1000) })
    ).toBe(true);
    expect(
      cardPaymentMatchesQuote({ paidKobo: nairaToKobo(1100), serverKobo: server, quotedKobo: nairaToKobo(1100) })
    ).toBe(true);
    expect(
      cardPaymentMatchesQuote({ paidKobo: nairaToKobo(100), serverKobo: server, quotedKobo: nairaToKobo(100) })
    ).toBe(false);
  });

  it('trusts a client quote within the server drift band', () => {
    const server = nairaToKobo(1000);
    expect(fareQuoteWithinServerBand(nairaToKobo(1200), server)).toBe(true);
    expect(fareQuoteWithinServerBand(nairaToKobo(800), server)).toBe(true);
    expect(fareQuoteWithinServerBand(nairaToKobo(1300), server)).toBe(false);
  });
});

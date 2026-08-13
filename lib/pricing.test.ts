import {
  PRICE_PER_KM,
  HAVERSINE_ROAD_FACTOR,
  computeFareFromDistanceKm,
  estimateRoadDistanceKm,
  haversineKm,
  nairaToKobo,
} from './pricing';

describe('pricing', () => {
  it('uses ₦250 per km', () => {
    expect(PRICE_PER_KM).toBe(250);
    expect(computeFareFromDistanceKm(2).totalCost).toBe(500);
    expect(computeFareFromDistanceKm(2).distanceKm).toBe(2);
  });

  it('rounds fare to 2 decimal places', () => {
    expect(computeFareFromDistanceKm(1.234).totalCost).toBe(308.5);
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
});

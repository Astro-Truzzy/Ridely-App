/** Shared fare rules — must match supabase/functions/_shared/pricing.ts */

export const PRICE_PER_KM = 250;
export const HAVERSINE_ROAD_FACTOR = 1.4;

export function computeFareFromDistanceKm(distanceKm: number): {
  distanceKm: number;
  totalCost: number;
} {
  const d = Number(distanceKm);
  if (!Number.isFinite(d) || d < 0) {
    throw new Error('Invalid distance');
  }
  const totalCost = Number((d * PRICE_PER_KM).toFixed(2));
  return { distanceKm: Number(d.toFixed(2)), totalCost };
}

/** Great-circle km between two WGS84 points. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Fallback road estimate when Directions is unavailable. */
export function estimateRoadDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return haversineKm(lat1, lon1, lat2, lon2) * HAVERSINE_ROAD_FACTOR;
}

/** Paystack amount in kobo for a naira total. */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

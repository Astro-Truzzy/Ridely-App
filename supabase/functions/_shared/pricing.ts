/** Shared fare rules — must match lib/pricing.ts in the mobile app */

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

export function estimateRoadDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return haversineKm(lat1, lon1, lat2, lon2) * HAVERSINE_ROAD_FACTOR;
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export async function fetchDirectionsDistanceKm(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  apiKey: string
): Promise<number | null> {
  const params = new URLSearchParams({
    origin: `${originLat},${originLng}`,
    destination: `${destLat},${destLng}`,
    mode: 'driving',
    key: apiKey,
  });
  const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    const meters = data?.routes?.[0]?.legs?.[0]?.distance?.value;
    if (typeof meters === 'number' && Number.isFinite(meters) && meters >= 0) {
      return meters / 1000;
    }
  } catch {
    // fall through
  }
  return null;
}

/** Authoritative distance + fare from coordinates. */
export async function computeServerFare(opts: {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  mapsApiKey?: string | null;
}): Promise<{ distanceKm: number; totalCost: number }> {
  let distanceKm: number | null = null;
  if (opts.mapsApiKey) {
    distanceKm = await fetchDirectionsDistanceKm(
      opts.pickupLat,
      opts.pickupLng,
      opts.dropoffLat,
      opts.dropoffLng,
      opts.mapsApiKey
    );
  }
  if (distanceKm == null) {
    distanceKm = estimateRoadDistanceKm(
      opts.pickupLat,
      opts.pickupLng,
      opts.dropoffLat,
      opts.dropoffLng
    );
  }
  return computeFareFromDistanceKm(distanceKm);
}

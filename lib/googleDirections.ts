/**
 * Google Directions API and polyline decoding.
 * Use EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (or EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY) for Directions.
 */

function getApiKey(): string {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ||
    ''
  );
}

/**
 * Decode Google's encoded polyline format into lat/lng pairs.
 * @see https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
  const points: Array<{ latitude: number; longitude: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }
  return points;
}

export interface DirectionsResult {
  distanceKm: number;
  durationSeconds: number;
  coordinates: Array<{ latitude: number; longitude: number }>;
}

/**
 * Fetch driving route from Google Directions API.
 * Returns distance, duration, and decoded polyline coordinates.
 */
export async function fetchGoogleDirections(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): Promise<DirectionsResult | null> {
  const key = getApiKey();
  if (!key) {
    console.warn('Google Maps API key not configured. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.');
    return null;
  }

  const origin = `${lat1},${lon1}`;
  const destination = `${lat2},${lon2}`;
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${key}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== 'OK' || !data.routes?.length) return null;

    const route = data.routes[0];
    const leg = route.legs?.[0];
    const distanceMeters = leg?.distance?.value ?? 0;
    const durationSeconds = leg?.duration?.value ?? 0;
    const encoded = route.overview_polyline?.points ?? '';
    const coordinates = encoded ? decodePolyline(encoded) : [];

    return {
      distanceKm: distanceMeters / 1000,
      durationSeconds,
      coordinates,
    };
  } catch (error) {
    console.error('Google Directions API error:', error);
    return null;
  }
}

/**
 * Geocode an address string to coordinates using Google Geocoding API.
 * Returns the first result's lat/lng or null.
 */
export async function geocodeAddress(
  address: string
): Promise<{ latitude: number; longitude: number } | null> {
  const key = getApiKey();
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
  try {
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const data = await response.json();
    const loc = data?.results?.[0]?.geometry?.location;
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      return { latitude: loc.lat, longitude: loc.lng };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Reverse geocode coordinates to a formatted address using Google Geocoding API.
 */
export async function reverseGeocodeCoords(
  latitude: number,
  longitude: number
): Promise<string | null> {
  const key = getApiKey();
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${key}`;
  try {
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const data = await response.json();
    const formatted = data?.results?.[0]?.formatted_address;
    if (typeof formatted === 'string' && formatted.trim()) {
      return formatted.replace(/, Nigeria$/, '').trim();
    }
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

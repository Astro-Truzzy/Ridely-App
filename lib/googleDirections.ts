/**
 * Google Directions API and polyline decoding.
 * Requests are routed through googleMapsRequest so they work on web (via the
 * google-maps Supabase Edge Function proxy) as well as native.
 */

import { googleMapsRequest } from '@/lib/googleMapsClient';

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
  const origin = `${lat1},${lon1}`;
  const destination = `${lat2},${lon2}`;

  try {
    const data = await googleMapsRequest('directions/json', { origin, destination });
    if (!data || data.status !== 'OK' || !data.routes?.length) return null;

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
  try {
    const data = await googleMapsRequest('geocode/json', { address });
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
  try {
    const data = await googleMapsRequest('geocode/json', { latlng: `${latitude},${longitude}` });
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

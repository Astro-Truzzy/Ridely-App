import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Google Maps web-service client.
 *
 * Routes through the authenticated `google-maps` Edge Function (server key).
 * Falls back to a direct request on native if the proxy is unavailable.
 */

type GoogleMapsPath =
  | 'place/autocomplete/json'
  | 'place/details/json'
  | 'geocode/json'
  | 'directions/json';

function getApiKey(): string {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ||
    ''
  );
}

async function fetchViaProxy(
  path: GoogleMapsPath,
  params: Record<string, string>,
  signal?: AbortSignal
): Promise<any | null> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !anonKey) {
    console.warn('Supabase URL/anon key missing; cannot proxy Google Maps request.');
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    console.warn('Not signed in; cannot call google-maps proxy.');
    return null;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/google-maps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ path, params }),
    signal,
  });
  if (!response.ok) return null;
  return response.json();
}

async function fetchDirect(
  path: GoogleMapsPath,
  params: Record<string, string>,
  signal?: AbortSignal
): Promise<any | null> {
  const key = getApiKey();
  if (!key) {
    console.warn('Google Maps API key not found. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.');
    return null;
  }
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null) search.append(k, String(v));
  }
  search.append('key', key);
  const url = `https://maps.googleapis.com/maps/api/${path}?${search.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) return null;
  return response.json();
}

/**
 * Fetch a Google Maps web-service endpoint via the authenticated Edge proxy.
 */
export async function googleMapsRequest(
  path: GoogleMapsPath,
  params: Record<string, string>,
  signal?: AbortSignal
): Promise<any | null> {
  const proxied = await fetchViaProxy(path, params, signal);
  if (proxied != null) return proxied;
  if (Platform.OS !== 'web') {
    return fetchDirect(path, params, signal);
  }
  return null;
}

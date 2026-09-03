import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Google Maps web-service client.
 *
 * Routes through the authenticated `google-maps` Edge Function (server key).
 * Falls back to a direct request on native if the proxy is unavailable
 * or Google denies the server key.
 */

type GoogleMapsPath =
  | 'place/autocomplete/json'
  | 'place/details/json'
  | 'geocode/json'
  | 'directions/json';

function getApiKey(): string {
  const shared = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const android = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY || '';
  const ios = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY || '';
  if (Platform.OS === 'ios') return shared || ios || android;
  return shared || android || ios;
}

function isDeniedMapsPayload(data: unknown): boolean {
  if (!data || typeof data !== 'object') return true;
  const payload = data as { error?: unknown; status?: string; error_message?: string };
  if (payload.error && !payload.status) return true;
  return payload.status === 'REQUEST_DENIED';
}

function logMapsFailure(source: string, path: GoogleMapsPath, data: unknown) {
  const payload = data as { status?: string; error?: unknown; error_message?: string } | null;
  console.warn(
    'Google Maps request failed',
    source,
    path,
    payload?.status || payload?.error || 'no payload',
    payload?.error_message || '',
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
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    logMapsFailure('proxy-http', path, data);
    return null;
  }
  return data;
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
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    logMapsFailure('direct-http', path, data);
    return null;
  }
  return data;
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
  if (proxied != null && !isDeniedMapsPayload(proxied)) return proxied;
  if (proxied != null) logMapsFailure('proxy', path, proxied);

  if (Platform.OS !== 'web') {
    const direct = await fetchDirect(path, params, signal);
    if (direct != null && !isDeniedMapsPayload(direct)) return direct;
    if (direct != null) logMapsFailure('direct', path, direct);
    return direct ?? proxied;
  }
  return proxied;
}

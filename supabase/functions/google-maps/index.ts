import { createClient } from 'npm:@supabase/supabase-js@2';
import { assertAllowedPath } from './allowedPaths.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseLatLng(location: string | undefined): { latitude: number; longitude: number } | null {
  if (!location) return null;
  const [latS, lngS] = String(location).split(',');
  const latitude = Number(latS);
  const longitude = Number(lngS);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ error: 'Supabase config missing' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: authUser },
    error: authError,
  } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authError || !authUser) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    );
  }

  const key = Deno.env.get('GOOGLE_MAPS_SERVER_KEY') || Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!key) {
    return new Response(
      JSON.stringify({ error: 'GOOGLE_MAPS_SERVER_KEY not set' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { path, params } = body as { path: string; params: Record<string, string> };

    if (!path || !assertAllowedPath(path)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or unsupported path' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
      if (v != null) search.append(k, String(v));
    }
    search.append('key', key);

    if (path === 'place/autocomplete/json' && params?.input) {
      const center = parseLatLng(params.location);
      const radius = Number(params.radius || 25000);
      const autocompleteBody: Record<string, unknown> = {
        input: String(params.input),
        includedRegionCodes: ['ng'],
      };
      if (center) {
        autocompleteBody.locationBias = {
          circle: {
            center,
            radius: Number.isFinite(radius) ? radius : 25000,
          },
        };
      }

      const placesNew = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask':
            'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
        },
        body: JSON.stringify(autocompleteBody),
      });
      const placesBody = await placesNew.json();
      if (placesNew.ok && Array.isArray(placesBody?.suggestions)) {
        const predictions = placesBody.suggestions
          .map((s: { placePrediction?: { placeId?: string; text?: { text?: string } } }) => {
            const placeId = s.placePrediction?.placeId?.replace(/^places\//, '');
            const description = s.placePrediction?.text?.text;
            if (!placeId || !description) return null;
            return { place_id: placeId, description };
          })
          .filter(Boolean);
        return new Response(
          JSON.stringify({
            status: predictions.length ? 'OK' : 'ZERO_RESULTS',
            predictions,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      console.warn('Places autocomplete (New) unavailable', placesNew.status, placesBody?.error || placesBody);
    }

    if (path === 'place/details/json' && params?.place_id) {
      const placeId = String(params.place_id).replace(/^places\//, '');
      const detailsNew = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
        {
          headers: {
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'id,formattedAddress,location,addressComponents',
          },
        }
      );
      const detailsBody = await detailsNew.json();
      if (detailsNew.ok && detailsBody?.location) {
        return new Response(
          JSON.stringify({
            status: 'OK',
            result: {
              geometry: {
                location: {
                  lat: detailsBody.location.latitude,
                  lng: detailsBody.location.longitude,
                },
              },
              formatted_address: detailsBody.formattedAddress,
              address_components: (detailsBody.addressComponents || []).map(
                (c: { longText?: string; types?: string[] }) => ({
                  long_name: c.longText,
                  types: c.types || [],
                })
              ),
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      if (!detailsNew.ok) {
        console.warn('Place details (New) unavailable', detailsNew.status, detailsBody?.error || detailsBody);
      }
    }

    const url = `https://maps.googleapis.com/maps/api/${path}?${search.toString()}`;
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (data?.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('Google Maps legacy request failed', path, data.status, data.error_message);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    console.error('google-maps proxy error', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

import { createClient } from 'npm:@supabase/supabase-js@2';
import { assertAllowedPath } from './allowedPaths.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      const placesNew = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask':
            'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
        },
        body: JSON.stringify({
          input: String(params.input),
          includedRegionCodes: ['ng'],
        }),
      });
      const placesBody = await placesNew.json();
      if (Array.isArray(placesBody?.suggestions)) {
        const predictions = placesBody.suggestions
          .map((s: { placePrediction?: { placeId?: string; text?: { text?: string } } }) => {
            const placeId = s.placePrediction?.placeId;
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
    }

    const url = `https://maps.googleapis.com/maps/api/${path}?${search.toString()}`;
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    const data = await res.json();

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

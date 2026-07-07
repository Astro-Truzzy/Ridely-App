// Deprecated: inline payment flow is disabled by product/security policy.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return new Response(JSON.stringify({
    error:
      'paystack-inline-form is deprecated. Use paystack-initialize and open authorization_url in WebView.',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 410,
  });
});

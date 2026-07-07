// Paystack redirects here after payment. Return a simple success page so the app's WebView
// can detect this URL and then verify the transaction and close.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const successHtml = (reference: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Payment successful</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; background: #f0f9ff; }
    .box { background: #fff; padding: 32px; border-radius: 16px; text-align: center; max-width: 360px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    h1 { color: #0f766e; margin: 0 0 8px; font-size: 24px; }
    p { color: #475569; margin: 0; font-size: 16px; line-height: 1.5; }
    .ref { font-size: 12px; color: #94a3b8; margin-top: 16px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Payment successful</h1>
    <p>You can close this window and return to the Ridely app.</p>
    <p class="ref" id="ref">${reference}</p>
  </div>
</body>
</html>
`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const reference = url.searchParams.get('reference') || '';

  return new Response(successHtml(reference), {
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    status: 200,
  });
});

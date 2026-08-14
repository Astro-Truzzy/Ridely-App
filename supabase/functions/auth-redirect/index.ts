const APP_SCHEMES = ['Ridely', 'ridely'];

function htmlPage(body: string): Response {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opening Ridely</title>
  <style>
    body { margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:#0B1220; color:#F8FAFC; }
    .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { width:100%; max-width:420px; background:#111827; border:1px solid #1F2937; border-radius:20px; padding:32px 28px; text-align:center; }
    .mark { width:56px; height:56px; margin:0 auto 16px; border-radius:16px; background:#174AFF; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:22px; }
    h1 { margin:0 0 8px; font-size:22px; }
    p { margin:0 0 20px; color:#94A3B8; line-height:1.5; }
    a.btn { display:inline-block; background:#174AFF; color:#fff; text-decoration:none; font-weight:600; padding:14px 22px; border-radius:12px; }
  </style>
</head>
<body>${body}</body>
</html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );
}

Deno.serve((req) => {
  const url = new URL(req.url);
  const nextRaw = url.searchParams.get('next') || 'callback';
  const next = nextRaw === 'reset-password' ? 'reset-password' : 'callback';

  return htmlPage(`
    <div class="wrap">
      <div class="card">
        <div class="mark">R</div>
        <h1>Opening Ridely</h1>
        <p id="msg">Your email is confirmed. Tap below if the app does not open automatically.</p>
        <a id="open" class="btn" href="Ridely://${next}">Open Ridely</a>
      </div>
    </div>
    <script>
      (function () {
        var next = ${JSON.stringify(next)};
        var search = window.location.search || '';
        var hash = window.location.hash || '';
        var suffix = search + hash;
        var schemes = ${JSON.stringify(APP_SCHEMES)};
        var primary = schemes[0] + '://' + next + suffix;
        document.getElementById('open').href = primary;
        var params = new URLSearchParams((search.charAt(0) === '?' ? search.slice(1) : search) + '&' + (hash.charAt(0) === '#' ? hash.slice(1) : hash));
        if (params.get('error')) {
          document.getElementById('msg').textContent = params.get('error_description') || params.get('error') || 'This link is invalid or has expired.';
          document.getElementById('open').textContent = 'Back to Ridely';
          return;
        }
        window.location.replace(primary);
        setTimeout(function () {
          if (schemes[1]) window.location.replace(schemes[1] + '://' + next + suffix);
        }, 400);
      })();
    </script>
  `);
});

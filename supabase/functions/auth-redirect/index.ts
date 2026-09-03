const APP_SCHEME = 'Ridely';
const ANDROID_PACKAGE = 'com.deliveryapp.ridely';

function appLocation(next: string, search: string, userAgent: string): string {
  const path = `${next}${search}`;
  if (/android/i.test(userAgent)) {
    return `intent://${path}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};end`;
  }
  return `${APP_SCHEME}://${path}`;
}

/**
 * Email clients can open this HTTPS URL. We then deep-link into the app.
 *
 * Do not return HTML: Supabase rewrites GET text/html to text/plain and
 * Safari downloads it as auth-redirect.txt instead of opening the app.
 */
Deno.serve((req) => {
  const url = new URL(req.url);
  const nextRaw = url.searchParams.get('next') || 'callback';
  const next = nextRaw === 'reset-password' ? 'reset-password' : 'callback';

  const forwarded = new URLSearchParams(url.searchParams);
  forwarded.delete('next');
  const search = forwarded.toString() ? `?${forwarded.toString()}` : '';
  const location = appLocation(next, search, req.headers.get('user-agent') || '');

  return new Response(
    `Opening Ridely…\n\nIf the app does not open, paste this link on your phone:\n${APP_SCHEME}://${next}${search}\n`,
    {
      status: 302,
      headers: {
        Location: location,
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    },
  );
});

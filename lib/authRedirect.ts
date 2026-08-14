const PROJECT_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ||
  'https://ihvuufwbbuiafmxzkdui.supabase.co';

export type AuthRedirectNext = 'callback' | 'reset-password';

/** HTTPS landing page email clients can open; it then deep-links into the app. */
export function getAuthRedirectUrl(next: AuthRedirectNext = 'callback'): string {
  return `${PROJECT_URL}/functions/v1/auth-redirect?next=${encodeURIComponent(next)}`;
}

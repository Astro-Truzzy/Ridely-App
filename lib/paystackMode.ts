/**
 * Client-side Paystack mode. Only EXPO_PUBLIC_* values are available in the app.
 * Test keys start with pk_test_ — show a banner so beta testers know sandbox cards are expected.
 * Defaults to test for beta unless a live public key or EXPO_PUBLIC_PAYSTACK_TEST_MODE=false is set.
 */
export function isPaystackTestMode(): boolean {
  const flag = process.env.EXPO_PUBLIC_PAYSTACK_TEST_MODE;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  const key = process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || '';
  if (key.startsWith('pk_live_')) return false;
  return true;
}

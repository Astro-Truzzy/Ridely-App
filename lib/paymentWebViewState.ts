/**
 * Holds pending payment URL and intent for the shared payment-webview screen.
 * Used to pass long authorization_url without putting it in route params.
 */
export type PaymentIntent = 'add_card' | 'fund_wallet';

let pending: { url: string; intent: PaymentIntent } | null = null;

export function setPendingPayment(url: string, intent: PaymentIntent): void {
  pending = { url, intent };
}

export function consumePendingPayment(): { url: string; intent: PaymentIntent } | null {
  const p = pending;
  pending = null;
  return p;
}

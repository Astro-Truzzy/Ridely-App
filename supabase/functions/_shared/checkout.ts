// Shared bank-transfer checkout helpers (Phase 3: central-account collection).
// Pure functions so they are unit-testable with `npm run test:functions`.

/** Checkout channels the app is allowed to request from Paystack. */
export const ALLOWED_CHECKOUT_CHANNELS = ['card', 'bank_transfer'] as const;
export type CheckoutChannel = (typeof ALLOWED_CHECKOUT_CHANNELS)[number];

const IDEMPOTENCY_KEY_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;

/**
 * Resolve the client-requested channels against the allowlist. Defaults to
 * card-only (existing behavior) when nothing valid is requested.
 */
export function resolveCheckoutChannels(requested: unknown): CheckoutChannel[] {
  if (!Array.isArray(requested) || requested.length === 0) return ['card'];
  const allowed = requested.filter((c): c is CheckoutChannel =>
    ALLOWED_CHECKOUT_CHANNELS.includes(c as CheckoutChannel)
  );
  return allowed.length > 0 ? [...new Set(allowed)] : ['card'];
}

/** Validate an optional client idempotency key (null when absent/invalid use). */
export function normalizeIdempotencyKey(raw: unknown): string | null {
  const key = String(raw ?? '').trim();
  if (!key) return null;
  if (!IDEMPOTENCY_KEY_REGEX.test(key)) {
    throw new Error('Invalid idempotency key format');
  }
  return key;
}

/**
 * Build the internal payment reference shown to the customer
 * (e.g. RDL-XXXXXX). Uniqueness is enforced by the payments.reference
 * unique constraint; entropy here makes collisions vanishingly unlikely.
 */
export function buildInternalReference(idempotencyKey: string | null): string {
  if (idempotencyKey) return `RDL-${idempotencyKey}`;
  const time = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RDL-${time}${rand}`;
}

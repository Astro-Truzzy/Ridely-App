// Transient, retryable failures: Cloudflare origin timeouts (522/520/521/523/524),
// gateway/service errors (502/503/504) and low-level network hiccups. These are
// upstream/infra blips, not client mistakes, so a short backoff usually recovers.
const TRANSIENT_ERROR = /(error code: 5\d\d|\b5(?:0[234]|2[0-4])\b|timed out|timeout|network request failed|fetch failed|econnreset|econnaborted)/i;

export function isTransientError(err: unknown): boolean {
  if (!err) return false;
  const message =
    typeof err === 'string'
      ? err
      : (err as { message?: string } | null)?.message ?? '';
  return TRANSIENT_ERROR.test(String(message));
}

type RetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  shouldRetry?: (err: unknown) => boolean;
};

/**
 * Runs `fn`, retrying with exponential backoff (+ jitter) when it throws a
 * transient error. Non-transient errors are rethrown immediately.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries = 3, baseDelayMs = 500, shouldRetry = isTransientError } = options;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) throw err;
      const delay = baseDelayMs * 2 ** attempt + Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }
}

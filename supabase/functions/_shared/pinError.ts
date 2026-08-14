/** Format PIN verify failures for wallet-withdraw / rider-payout. */
export function formatWithdrawalPinError(body: {
  error?: string;
  pin_locked?: boolean;
  locked?: boolean;
  attempts_left?: number;
  locked_until?: string | null;
}): string {
  const locked = !!(body.pin_locked || body.locked || body.locked_until);
  if (locked) {
    const until = formatLockUntil(body.locked_until);
    return until
      ? `Too many failed attempts. PIN locked until ${until}.`
      : 'Too many failed attempts. PIN is locked. Try again later.';
  }

  if (typeof body.attempts_left === 'number') {
    const n = body.attempts_left;
    if (n <= 0) {
      return 'Incorrect PIN. No attempts left. PIN is locked for 15 minutes.';
    }
    return `Incorrect PIN. ${n} attempt${n === 1 ? '' : 's'} left.`;
  }

  return body.error || 'Invalid withdrawal PIN';
}

function formatLockUntil(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export function pinFailurePayload(pinResult: {
  valid?: boolean;
  error?: string;
  locked?: boolean;
  attempts_left?: number;
  locked_until?: string | null;
}): { error: string; pin_locked: boolean; attempts_left?: number; locked_until?: string | null } {
  return {
    error: formatWithdrawalPinError(pinResult),
    pin_locked: !!pinResult.locked,
    attempts_left: pinResult.attempts_left,
    locked_until: pinResult.locked_until ?? null,
  };
}

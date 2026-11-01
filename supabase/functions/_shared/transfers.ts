// Shared Paystack transfer primitives used by rider-payout (manual) and
// settlement-run (scheduled batches). One implementation of the
// resolve -> recipient -> transfer flow and its edge semantics:
//   - API acceptance is NOT success (status comes from data.status / webhook).
//   - Duplicate-reference responses mean the transfer is already in flight.
//   - Network/timeout failures are UNCERTAIN — callers must keep funds reserved
//     and let the webhook reconcile, never blind-resubmit.

export interface ResolveResult {
  ok: boolean;
  accountName?: string;
  message?: string;
}

export async function resolveAccountName(
  secret: string,
  accountNumber: string,
  bankCode: string
): Promise<ResolveResult> {
  try {
    const res = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    const data = await res.json();
    if (!data.status) {
      return { ok: false, message: data.message || 'Could not verify bank account' };
    }
    return { ok: true, accountName: data.data.account_name as string };
  } catch {
    return { ok: false, message: 'Could not verify bank account' };
  }
}

export interface RecipientResult {
  ok: boolean;
  recipientCode?: string;
  message?: string;
}

export async function createTransferRecipient(
  secret: string,
  opts: { name: string; accountNumber: string; bankCode: string }
): Promise<RecipientResult> {
  try {
    const res = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name: opts.name,
        account_number: opts.accountNumber,
        bank_code: opts.bankCode,
        currency: 'NGN',
      }),
    });
    const data = await res.json();
    if (!data.status) {
      return { ok: false, message: data.message || 'Could not create transfer recipient' };
    }
    return { ok: true, recipientCode: data.data.recipient_code as string };
  } catch {
    return { ok: false, message: 'Could not create transfer recipient' };
  }
}

export interface TransferInitResult {
  /** Transport-level: Paystack accepted (or already has) the transfer. */
  ok: boolean;
  transferCode: string | null;
  /** Paystack-side status: 'success' | 'pending' | 'otp' | ... */
  status: string | null;
  message: string;
  /** True when Paystack reports this reference is already in flight. */
  duplicate: boolean;
}

const DUPLICATE_REF_REGEX = /duplicate|already exists|already been used/i;

export async function initiatePaystackTransfer(
  secret: string,
  opts: { amountKobo: number; recipientCode: string; reason: string; reference: string }
): Promise<TransferInitResult> {
  const res = await fetch('https://api.paystack.co/transfer', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: 'balance',
      amount: Math.round(opts.amountKobo),
      recipient: opts.recipientCode,
      reason: opts.reason,
      reference: opts.reference,
    }),
  });
  const data = await res.json();
  const message = String(data.message || '');
  if (!data.status) {
    if (DUPLICATE_REF_REGEX.test(message)) {
      return { ok: true, transferCode: null, status: 'pending', message, duplicate: true };
    }
    return { ok: false, transferCode: null, status: null, message, duplicate: false };
  }
  return {
    ok: true,
    transferCode: (data.data.transfer_code as string | undefined) ?? null,
    status: (data.data.status as string | undefined) ?? null,
    message,
    duplicate: false,
  };
}

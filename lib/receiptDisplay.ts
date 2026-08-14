import type { WalletTransaction } from '@/hooks/useTransactions';

export function formatNairaAmount(amount: number): string {
  return `₦${Number(amount || 0).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function transactionLabel(tx: WalletTransaction): string {
  if (tx.category === 'promo_credit') return 'Promo credit';
  if (tx.category === 'wallet_withdrawal') return 'Withdrawal';
  if (tx.category === 'wallet_topup') return 'Wallet top-up';
  if (tx.category === 'booking_charge') return 'Booking payment';
  if (tx.category === 'card_authorization') return 'Card authorization';
  if (tx.reference.startsWith('promo:')) return 'Promo credit';
  if (tx.reference.startsWith('wd_')) return 'Withdrawal';
  return tx.type === 'credit' ? 'Wallet top-up' : 'Payment';
}

export function transactionMethod(tx: WalletTransaction): string {
  if (tx.category === 'promo_credit' || tx.reference.startsWith('promo:')) return 'Promo code';
  if (tx.category === 'wallet_withdrawal') return 'Bank transfer';
  if (tx.provider === 'paystack' || tx.category === 'wallet_topup' || tx.category === 'booking_charge' || tx.category === 'card_authorization') {
    return 'Card (Paystack)';
  }
  if (tx.provider) return tx.provider;
  return 'Wallet';
}

export function transactionStatusLabel(tx: WalletTransaction): string {
  if (tx.category === 'wallet_withdrawal') {
    if (tx.status === 'pending') return 'Processing';
    if (tx.status === 'success') return 'Paid out';
    if (tx.status === 'failed' || tx.status === 'reversed') return 'Failed / refunded';
  }
  switch (tx.status) {
    case 'success':
      return 'Successful';
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
    case 'reversed':
      return 'Reversed';
    default:
      return tx.status || 'Unknown';
  }
}

export function transactionReference(tx: WalletTransaction): string {
  return tx.provider_reference || tx.reference || tx.id;
}

/**
 * Paystack integration (Test or Live).
 * Uses Supabase Edge Functions to keep the secret key server-side.
 */

import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/** User JWT headers for authenticated Paystack edge functions. */
async function getUserAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!token) {
    throw new Error('You must be logged in to continue with payment.');
  }
  return {
    Authorization: `Bearer ${token}`,
    apikey: anon,
  };
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context) {
    try {
      const body = await error.context.json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
      if (body?.msg) return String(body.msg);
    } catch {
      try {
        const text = await error.context.text();
        if (text) {
          if (text.toLowerCase().includes('es256')) {
            return 'Edge Function JWT check is incompatible with ES256 tokens. Redeploy paystack functions from Ridely-App (see scripts/deploy-paystack-functions.mjs).';
          }
          return text.slice(0, 300);
        }
      } catch {
        // ignore
      }
    }
  }
  const message = error instanceof Error ? error.message : 'Payment request failed';
  if (message.toLowerCase().includes('es256')) {
    return 'Edge Function JWT check is incompatible with ES256 tokens. Redeploy paystack functions from Ridely-App (see scripts/deploy-paystack-functions.mjs).';
  }
  return message;
}

export interface InitializeResult {
  authorization_url: string;
  reference: string;
  access_code: string;
}

export async function initializePaystackTransaction(params: {
  amountInKobo: number;
  email: string;
  callbackUrl?: string;
  metadata?: Record<string, string>;
  /** Restrict to specific channels, e.g. ['card'] to show only card form (no USSD/bank). */
  channels?: string[];
}): Promise<InitializeResult> {
  const headers = await getUserAuthHeaders();
  const { data, error } = await supabase.functions.invoke('paystack-initialize', {
    headers,
    body: {
      amount_in_kobo: params.amountInKobo,
      email: params.email,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
      channels: params.channels,
    },
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  const result = data as InitializeResult | { error?: string; message?: string } | null;
  if (!result?.authorization_url) {
    throw new Error(result?.error || result?.message || 'No payment URL returned');
  }

  return result as InitializeResult;
}

export interface VerifyResult {
  success: boolean;
  data?: { status: string; reference: string; amount: number; [k: string]: unknown };
  error?: string;
}

export async function verifyPaystackTransaction(reference: string): Promise<VerifyResult> {
  try {
    const headers = await getUserAuthHeaders();
    const { data, error } = await supabase.functions.invoke('paystack-verify', {
      headers,
      body: { reference },
    });

    if (error) {
      return { success: false, error: await getFunctionErrorMessage(error) };
    }

    const result = data as { success?: boolean; data?: VerifyResult['data']; error?: string };
    return { success: !!result?.success, data: result?.data, error: result?.error };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Verification failed' };
  }
}

/** URL path the app's WebView should detect after Paystack redirect (callback). */
export function getPaystackCallbackPath(): string {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  if (!base) return '';
  return base.replace(/\/$/, '') + '/functions/v1/paystack-callback';
}

export interface ChargeSavedCardResult {
  success: boolean;
  reference?: string;
  error?: string;
}

/** Charge a saved card via Paystack charge_authorization (server-side). */
export async function chargePaystackSavedCard(params: {
  amountInKobo: number;
  email?: string;
  authorizationCode?: string;
  paymentMethodId?: string;
  reference?: string;
  metadata?: Record<string, string>;
}): Promise<ChargeSavedCardResult> {
  if (!params.authorizationCode && !params.paymentMethodId) {
    throw new Error('authorizationCode or paymentMethodId is required');
  }

  try {
    const headers = await getUserAuthHeaders();
    const { data, error } = await supabase.functions.invoke('paystack-charge', {
      headers,
      body: {
        amount_in_kobo: params.amountInKobo,
        email: params.email,
        authorization_code: params.authorizationCode,
        payment_method_id: params.paymentMethodId,
        reference: params.reference,
        metadata: params.metadata,
      },
    });

    if (error) {
      return { success: false, error: await getFunctionErrorMessage(error) };
    }

    const result = data as {
      success?: boolean;
      error?: string;
      data?: { reference?: string; status?: string };
    };

    const reference = result.data?.reference;
    return {
      success: !!result.success,
      reference,
      error: result.success ? undefined : result.error || 'Charge failed',
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Charge failed' };
  }
}

/** Synthetic id for "pay with new card" on booking confirmation. */
export const PAYSTACK_NEW_CARD_OPTION_ID = '__paystack_new_card__';

export interface Bank {
  name: string;
  code: string;
}

/** Fetch the list of supported Nigerian banks (via Paystack). */
export async function fetchBanks(): Promise<Bank[]> {
  const headers = await getUserAuthHeaders();
  const { data, error } = await supabase.functions.invoke('paystack-banks?action=list', {
    method: 'GET',
    headers,
  });
  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }
  const result = data as { banks?: Bank[]; error?: string };
  if (!result?.banks) {
    throw new Error(result?.error || 'Could not load banks');
  }
  return result.banks;
}

/** Resolve an account number + bank code to the account holder's name. */
export async function resolveBankAccount(params: {
  accountNumber: string;
  bankCode: string;
}): Promise<string> {
  const headers = await getUserAuthHeaders();
  const { data, error } = await supabase.functions.invoke(
    `paystack-banks?action=resolve&account=${encodeURIComponent(params.accountNumber)}&bank_code=${encodeURIComponent(params.bankCode)}`,
    { method: 'GET', headers }
  );
  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }
  const result = data as { account_name?: string; error?: string };
  if (!result?.account_name) {
    throw new Error(result?.error || 'Could not verify account');
  }
  return result.account_name;
}

export interface WithdrawResult {
  success: boolean;
  amount?: number;
  account_name?: string;
  status?: string;
  message?: string;
  error?: string;
}

/** Withdraw from the wallet to a bank account (authenticated). */
export async function withdrawFromWallet(params: {
  amountInNaira: number;
  accountNumber: string;
  bankCode: string;
  idempotencyKey?: string;
  withdrawalPin: string;
}): Promise<WithdrawResult> {
  try {
    const headers = await getUserAuthHeaders();
    const { data, error } = await supabase.functions.invoke('wallet-withdraw', {
      headers,
      body: {
        amount: params.amountInNaira,
        account_number: params.accountNumber,
        bank_code: params.bankCode,
        idempotency_key: params.idempotencyKey,
        withdrawal_pin: params.withdrawalPin,
      },
    });

    if (error) {
      return { success: false, error: await getFunctionErrorMessage(error) };
    }

    const result = data as WithdrawResult;
    return {
      success: !!result?.success,
      amount: result?.amount,
      account_name: result?.account_name,
      status: result?.status,
      message: result?.message,
      error: result?.success ? undefined : result?.error || 'Withdrawal failed',
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Withdrawal failed' };
  }
}

export interface RiderPayoutResult {
  success: boolean;
  amount?: number;
  account_name?: string;
  status?: string;
  message?: string;
  error?: string;
}

/** Request rider earnings payout to bank (authenticated, requires withdrawal PIN). */
export async function requestRiderPayout(params: {
  accountNumber: string;
  bankCode: string;
  idempotencyKey?: string;
  withdrawalPin: string;
}): Promise<RiderPayoutResult> {
  try {
    const headers = await getUserAuthHeaders();
    const { data, error } = await supabase.functions.invoke('rider-payout', {
      headers,
      body: {
        account_number: params.accountNumber,
        bank_code: params.bankCode,
        idempotency_key: params.idempotencyKey,
        withdrawal_pin: params.withdrawalPin,
      },
    });

    if (error) {
      return { success: false, error: await getFunctionErrorMessage(error) };
    }

    const result = data as RiderPayoutResult;
    return {
      success: !!result?.success,
      amount: result?.amount,
      account_name: result?.account_name,
      status: result?.status,
      message: result?.message,
      error: result?.success ? undefined : result?.error || 'Payout failed',
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Payout failed' };
  }
}

/**
 * Paystack integration (Test or Live).
 * Uses Supabase Edge Functions to keep the secret key server-side.
 */

import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/** Anon JWT for public Paystack functions — avoids sending ES256 user tokens to the legacy verify_jwt gate. */
function getAnonAuthHeaders(): Record<string, string> {
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!anon) return {};
  return {
    Authorization: `Bearer ${anon}`,
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
  const { data, error } = await supabase.functions.invoke('paystack-initialize', {
    headers: getAnonAuthHeaders(),
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
  const { data, error } = await supabase.functions.invoke('paystack-verify', {
    headers: getAnonAuthHeaders(),
    body: { reference },
  });

  if (error) {
    return { success: false, error: await getFunctionErrorMessage(error) };
  }

  const result = data as { success?: boolean; data?: VerifyResult['data']; error?: string };
  return { success: !!result?.success, data: result?.data, error: result?.error };
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
}): Promise<ChargeSavedCardResult> {
  if (!params.authorizationCode && !params.paymentMethodId) {
    throw new Error('authorizationCode or paymentMethodId is required');
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return { success: false, error: 'You must be logged in to use a saved card.' };
  }

  const { data, error } = await supabase.functions.invoke('paystack-charge', {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    },
    body: {
      amount_in_kobo: params.amountInKobo,
      email: params.email,
      authorization_code: params.authorizationCode,
      payment_method_id: params.paymentMethodId,
      reference: params.reference,
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
}

/** Synthetic id for "pay with new card" on booking confirmation. */
export const PAYSTACK_NEW_CARD_OPTION_ID = '__paystack_new_card__';

import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context) {
    try {
      const body = await error.context.json();
      if (body?.error) return String(body.error);
    } catch {
      // ignore
    }
  }
  return error instanceof Error ? error.message : 'Request failed';
}

export interface WithdrawalPinStatus {
  has_pin: boolean;
  locked?: boolean;
  locked_until?: string | null;
}

export async function fetchWithdrawalPinStatus(): Promise<WithdrawalPinStatus> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return { has_pin: false };
  }

  const { data, error } = await supabase.functions.invoke('withdrawal-pin', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    },
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  return (data as WithdrawalPinStatus) ?? { has_pin: false };
}

export async function setWithdrawalPin(params: {
  pin: string;
  currentPin?: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return { success: false, error: 'You must be logged in.' };
  }

  const { data, error } = await supabase.functions.invoke('withdrawal-pin', {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    },
    body: {
      pin: params.pin,
      current_pin: params.currentPin,
    },
  });

  if (error) {
    return { success: false, error: await getFunctionErrorMessage(error) };
  }

  const result = data as { success?: boolean; error?: string; message?: string };
  return {
    success: !!result?.success,
    error: result?.success ? undefined : result?.error || 'Could not save PIN',
    message: result?.message,
  };
}

export function isValidWithdrawalPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

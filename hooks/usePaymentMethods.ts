import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/** Keep one entry per (type, label); prefer default, then first by created order. */
function dedupeMethods(rows: PaymentMethodRow[]): PaymentMethodRow[] {
  const seen = new Map<string, PaymentMethodRow>();
  for (const row of rows) {
    const key = `${row.type}:${row.label}`;
    const existing = seen.get(key);
    if (!existing || (row.is_default && !existing.is_default)) {
      seen.set(key, row);
    }
  }
  return [...seen.values()].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export type PaymentMethodType = 'card' | 'wallet' | 'cash' | 'bank';

export interface PaymentMethodRow {
  id: string;
  user_id: string;
  type: PaymentMethodType;
  label: string;
  last_four: string | null;
  brand: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  gateway_payment_method_id: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethodDisplay {
  id: string;
  type: PaymentMethodType;
  label: string;
  details: string;
  lastFour?: string;
  expiry?: string;
  brand?: string;
  isDefault: boolean;
  /** Paystack authorization_code — required to charge saved card without WebView. */
  gatewayPaymentMethodId?: string | null;
}

function rowToDisplay(row: PaymentMethodRow): PaymentMethodDisplay {
  const expiry =
    row.expiry_month != null && row.expiry_year != null
      ? `${String(row.expiry_month).padStart(2, '0')}/${String(row.expiry_year).slice(-2)}`
      : undefined;
  let details = '';
  if (row.type === 'card' && row.last_four) {
    details = `•••• •••• •••• ${row.last_four}`;
  } else if (row.type === 'wallet') {
    details = 'Balance: ₦0.00'; // Could come from wallet balance later
  } else if (row.type === 'cash') {
    details = 'Pay the rider directly';
  } else {
    details = row.label;
  }
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    details,
    lastFour: row.last_four ?? undefined,
    expiry,
    brand: row.brand ?? undefined,
    isDefault: row.is_default,
    gatewayPaymentMethodId: row.gateway_payment_method_id,
  };
}

export function usePaymentMethods() {
  const { user, userType } = useAuth();
  const [methods, setMethods] = useState<PaymentMethodDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const placeholderInsertedRef = useRef(false);

  const fetchMethods = useCallback(async () => {
    if (!user?.id) {
      setMethods([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // payment_methods may not be in generated Database types; use untyped client so the query runs
      const query = (supabase as any)
        .from('payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      const timeoutMs = 15000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Check your connection and try again.')), timeoutMs)
      );
      const { data, error: e } = await Promise.race([query, timeoutPromise]);

      if (e) throw e;
      const deduped = dedupeMethods((data ?? []) as PaymentMethodRow[]);
      setMethods(deduped.map(rowToDisplay));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load payment methods. Ensure the payment_methods table exists (run the migration) and you are signed in.';
      setError(message);
      setMethods([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const setDefault = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      try {
        const { error: e } = await (supabase as any)
          .from('payment_methods')
          .update({ is_default: true })
          .eq('id', id)
          .eq('user_id', user.id);
        if (e) throw e;
        await fetchMethods();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to set default');
      }
    },
    [user?.id, fetchMethods]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      try {
        const { error: e } = await (supabase as any)
          .from('payment_methods')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);
        if (e) throw e;
        await fetchMethods();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove');
      }
    },
    [user?.id, fetchMethods]
  );

  const addPlaceholderMethodsIfEmpty = useCallback(async () => {
    if (!user?.id || methods.length > 0 || userType !== 'user' || placeholderInsertedRef.current) return;
    placeholderInsertedRef.current = true;
    try {
      const { data: existing } = await (supabase as any)
        .from('payment_methods')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'cash')
        .eq('label', 'Cash on Delivery')
        .limit(1);
      if (existing && existing.length > 0) {
        await fetchMethods();
        return;
      }
      await (supabase as any).from('payment_methods').insert({
        user_id: user.id,
        type: 'cash',
        label: 'Cash on Delivery',
        is_default: true,
      });
      await fetchMethods();
    } catch {
      placeholderInsertedRef.current = false;
    }
  }, [user?.id, userType, methods.length, fetchMethods]);

  return {
    methods,
    loading,
    error,
    refetch: fetchMethods,
    setDefault,
    remove,
    addPlaceholderMethodsIfEmpty,
  };
}

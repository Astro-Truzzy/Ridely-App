import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const qc = useQueryClient();
  const placeholderInsertedRef = useRef(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['payment_methods', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // payment_methods may not be in generated Database types; use untyped client so the query runs
      const q = (supabase as any)
        .from('payment_methods')
        .select('*')
        .eq('user_id', user!.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      const timeoutMs = 15000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Check your connection and try again.')), timeoutMs)
      );
      const { data, error } = await Promise.race([q, timeoutPromise]);
      if (error) throw error;
      const deduped = dedupeMethods((data ?? []) as PaymentMethodRow[]);
      return deduped.map(rowToDisplay);
    },
  });

  const methods = query.data ?? [];

  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: ['payment_methods', user?.id] }),
    [qc, user?.id]
  );

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
        setMutationError(null);
        await invalidate();
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : 'Failed to set default');
      }
    },
    [user?.id, invalidate]
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
        setMutationError(null);
        await invalidate();
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : 'Failed to remove');
      }
    },
    [user?.id, invalidate]
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
        await invalidate();
        return;
      }
      await (supabase as any).from('payment_methods').insert({
        user_id: user.id,
        type: 'cash',
        label: 'Cash on Delivery',
        is_default: true,
      });
      await invalidate();
    } catch {
      placeholderInsertedRef.current = false;
    }
  }, [user?.id, userType, methods.length, invalidate]);

  const { refetch: rqRefetch } = query;
  const refetch = useCallback(async () => {
    await rqRefetch();
  }, [rqRefetch]);

  return {
    methods,
    loading: query.isLoading,
    error: (query.error ? (query.error as Error).message : null) ?? mutationError,
    refetch,
    setDefault,
    remove,
    addPlaceholderMethodsIfEmpty,
  };
}

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface WalletTransaction {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  category: string | null;
  provider: string | null;
  provider_reference: string | null;
  metadata: Record<string, unknown> | null;
  reference: string;
  status: string;
  created_at: string;
}

export function useTransactions() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['transactions', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('transactions')
        .select('id, amount, type, category, provider, provider_reference, metadata, reference, status, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as WalletTransaction[];
    },
  });

  const { refetch: rqRefetch } = query;
  const refetch = useCallback(async () => {
    await rqRefetch();
  }, [rqRefetch]);

  return {
    transactions: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch,
  };
}

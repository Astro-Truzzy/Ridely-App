import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function useWallet() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['wallet', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('users_wallet')
        .select('balance')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.balance != null ? Number(data.balance) : 0;
    },
  });

  // Stable identity so consumers can safely list it in effect/callback deps.
  const { refetch: rqRefetch } = query;
  const refetch = useCallback(async () => {
    await rqRefetch();
  }, [rqRefetch]);

  return {
    balance: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch,
  };
}

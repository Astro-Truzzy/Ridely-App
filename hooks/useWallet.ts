import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function useWallet() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!user?.id) {
      setBalance(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await (supabase as any)
        .from('users_wallet')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (e) throw e;
      setBalance(data?.balance != null ? Number(data.balance) : 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wallet');
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { balance, loading, error, refetch };
}

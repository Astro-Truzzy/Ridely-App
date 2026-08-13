import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithdrawalPinStatus } from '@/lib/withdrawalPin';
import { useAuth } from '@/contexts/AuthContext';

export function useWithdrawalPin() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['withdrawal-pin', user?.id],
    enabled: !!user?.id,
    queryFn: fetchWithdrawalPinStatus,
  });

  const { refetch: rqRefetch } = query;
  const refetch = useCallback(async () => {
    await rqRefetch();
  }, [rqRefetch]);

  return {
    hasPin: query.data?.has_pin ?? false,
    locked: query.data?.locked ?? false,
    lockedUntil: query.data?.locked_until ?? null,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch,
  };
}

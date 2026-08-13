import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface SavedAddress {
  id: string;
  user_id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export function useSavedAddresses() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ['saved_addresses', user?.id];

  const query = useQuery({
    queryKey,
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_addresses')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedAddress[];
    },
  });

  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: ['saved_addresses', user?.id] }),
    [qc, user?.id]
  );

  const add = useCallback(
    async (params: { label: string; address: string; latitude: number; longitude: number }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error: e } = await (supabase as any).from('saved_addresses').insert({
        user_id: user.id,
        label: params.label.trim(),
        address: params.address.trim(),
        latitude: params.latitude,
        longitude: params.longitude,
      });
      if (e) throw e;
      await invalidate();
    },
    [user?.id, invalidate]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      const { error: e } = await supabase.from('saved_addresses').delete().eq('id', id).eq('user_id', user.id);
      if (e) throw e;
      await invalidate();
    },
    [user?.id, invalidate]
  );

  const { refetch: rqRefetch } = query;
  const refetch = useCallback(async () => {
    await rqRefetch();
  }, [rqRefetch]);

  return {
    addresses: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch,
    add,
    remove,
  };
}

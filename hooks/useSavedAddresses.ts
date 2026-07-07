import { useState, useEffect, useCallback } from 'react';
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
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAddresses = useCallback(async () => {
    if (!user?.id) {
      setAddresses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('saved_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (e) throw e;
      setAddresses((data ?? []) as SavedAddress[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load saved addresses');
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const add = useCallback(
    async (params: { label: string; address: string; latitude: number; longitude: number }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error: e } = await (supabase as any)
        .from('saved_addresses')
        .insert({
          user_id: user.id,
          label: params.label.trim(),
          address: params.address.trim(),
          latitude: params.latitude,
          longitude: params.longitude,
        });
      if (e) throw e;
      await fetchAddresses();
    },
    [user?.id, fetchAddresses]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      const { error: e } = await supabase.from('saved_addresses').delete().eq('id', id).eq('user_id', user.id);
      if (e) throw e;
      await fetchAddresses();
    },
    [user?.id, fetchAddresses]
  );

  return { addresses, loading, error, refetch: fetchAddresses, add, remove };
}

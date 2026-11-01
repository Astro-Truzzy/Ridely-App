import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/** True when the signed-in customer row carries the admin flag. */
export function useIsAdmin() {
  const { user } = useAuth();
  const userId = user?.id;
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!userId) {
        if (mounted) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }
      try {
        const { data } = await (supabase as any)
          .from('users')
          .select('is_admin')
          .eq('id', userId)
          .maybeSingle();
        if (mounted) setIsAdmin((data as { is_admin?: boolean } | null)?.is_admin === true);
      } catch {
        if (mounted) setIsAdmin(false);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId]);

  return { isAdmin, loading };
}

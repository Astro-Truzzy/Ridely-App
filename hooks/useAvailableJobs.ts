import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface AvailableJob {
  id: string;
  user_id: string;
  pickup_address: string;
  dropoff_address: string;
  parcel_size: 'small' | 'medium' | 'large';
  total_cost: number;
  distance: number;
  estimated_time: string;
  delivery_time: 'now' | 'scheduled';
  scheduled_time: string | null;
  created_at: string;
  users?: {
    full_name: string;
  };
}

export function useAvailableJobs() {
  const { user, userType } = useAuth();
  const [jobs, setJobs] = useState<AvailableJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && userType === 'rider') {
      fetchAvailableJobs();
      
      // Subscribe to real-time updates for new jobs
      const subscription = supabase
        .channel('available_jobs')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'deliveries',
            filter: 'status=eq.pending',
          },
          () => {
            fetchAvailableJobs();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'deliveries',
            filter: 'status=eq.rider_assigned',
          },
          () => {
            fetchAvailableJobs();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user, userType]);

  const fetchAvailableJobs = async () => {
    if (!user || userType !== 'rider') return;

    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          users:user_id (
            full_name
          )
        `)
        .eq('status', 'pending')
        .is('rider_id', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching available jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    jobs,
    loading,
    refetch: fetchAvailableJobs,
  };
}
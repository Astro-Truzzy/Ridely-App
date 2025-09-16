import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface Earning {
  id: string;
  delivery_id: string;
  rider_id: string;
  gross_amount: number;
  ridely_fee: number;
  net_amount: number;
  status: 'pending' | 'completed' | 'paid';
  created_at: string;
  updated_at: string;
  deliveries?: {
    pickup_address: string;
    dropoff_address: string;
    parcel_size: string;
  };
}

export function useEarnings() {
  const { user, userType } = useAuth();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [monthlyEarnings, setMonthlyEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && userType === 'rider') {
      fetchEarnings();
      
      // Subscribe to real-time updates
      const subscription = supabase
        .channel('earnings')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'earnings',
            filter: `rider_id=eq.${user.id}`,
          },
          () => {
            fetchEarnings();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user, userType]);

  const fetchEarnings = async () => {
    if (!user || userType !== 'rider') return;

    try {
      const { data, error } = await supabase
        .from('earnings')
        .select(`
          *,
          deliveries:delivery_id (
            pickup_address,
            dropoff_address,
            parcel_size
          )
        `)
        .eq('rider_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setEarnings(data || []);
      
      // Calculate totals
      const total = data?.reduce((sum, earning) => sum + earning.net_amount, 0) || 0;
      setTotalBalance(total);
      
      // Calculate today's earnings
      const today = new Date().toISOString().split('T')[0];
      const todayTotal = data?.filter(e => e.created_at.startsWith(today))
        .reduce((sum, earning) => sum + earning.net_amount, 0) || 0;
      setTodayEarnings(todayTotal);
      
      // Calculate weekly earnings
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const weeklyTotal = data?.filter(e => e.created_at >= weekAgo)
        .reduce((sum, earning) => sum + earning.net_amount, 0) || 0;
      setWeeklyEarnings(weeklyTotal);
      
      // Calculate monthly earnings
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const monthlyTotal = data?.filter(e => e.created_at >= monthAgo)
        .reduce((sum, earning) => sum + earning.net_amount, 0) || 0;
      setMonthlyEarnings(monthlyTotal);
      
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    earnings,
    totalBalance,
    todayEarnings,
    weeklyEarnings,
    monthlyEarnings,
    loading,
    refetch: fetchEarnings,
  };
}
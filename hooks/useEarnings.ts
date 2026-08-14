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

export interface RiderPayoutRequest {
  id: string;
  amount: number;
  status: string;
  account_number: string | null;
  created_at: string;
}

export const MIN_PAYOUT_NAIRA = 50;

export function getPayoutWaitReasons(opts: {
  available: number;
  inTransit: number;
  hasPin: boolean;
  hasBankOnFile: boolean;
  minimum?: number;
}): string[] {
  const min = opts.minimum ?? MIN_PAYOUT_NAIRA;
  if (opts.inTransit > 0) {
    return [`₦${opts.inTransit.toLocaleString('en-NG')} is on the way to your bank.`];
  }
  const reasons: string[] = [];
  if (opts.available <= 0) return reasons;
  if (!opts.hasPin) reasons.push('Set a 4-digit withdrawal PIN.');
  if (!opts.hasBankOnFile) reasons.push('Add your bank account.');
  if (opts.available < min) reasons.push(`Minimum payout is ₦${min}.`);
  return reasons;
}

export function useEarnings() {
  const { user, userType } = useAuth();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<RiderPayoutRequest[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [monthlyEarnings, setMonthlyEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && userType === 'rider') {
      fetchEarnings();

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
      const [{ data, error }, { data: payouts }] = await Promise.all([
        supabase
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
          .order('created_at', { ascending: false }),
        (supabase as any)
          .from('rider_payout_requests')
          .select('id, amount, status, account_number, created_at')
          .eq('rider_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (error) throw error;

      setEarnings((data || []) as Earning[]);
      setPayoutRequests((payouts || []) as RiderPayoutRequest[]);

      const total = data?.reduce((sum, earning) => sum + earning.net_amount, 0) || 0;
      setTotalBalance(total);

      const today = new Date().toISOString().split('T')[0];
      const todayTotal = data?.filter(e => e.created_at.startsWith(today))
        .reduce((sum, earning) => sum + earning.net_amount, 0) || 0;
      setTodayEarnings(todayTotal);

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const weeklyTotal = data?.filter(e => e.created_at >= weekAgo)
        .reduce((sum, earning) => sum + earning.net_amount, 0) || 0;
      setWeeklyEarnings(weeklyTotal);

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

  const availableAmount = earnings
    .filter((e) => e.status === 'pending' || e.status === 'completed')
    .reduce((sum, e) => sum + Number(e.net_amount || 0), 0);

  const inTransitAmount = payoutRequests
    .filter((p) => p.status === 'initiated' || p.status === 'transfer_pending')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const paidOutAmount = payoutRequests
    .filter((p) => p.status === 'transfer_success')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const hasBankOnFile = payoutRequests.some((p) => !!p.account_number);

  return {
    earnings,
    payoutRequests,
    totalBalance,
    todayEarnings,
    weeklyEarnings,
    monthlyEarnings,
    availableAmount,
    inTransitAmount,
    paidOutAmount,
    hasBankOnFile,
    loading,
    refetch: fetchEarnings,
  };
}

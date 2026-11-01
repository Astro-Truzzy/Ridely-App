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
  amount_kobo?: number | null;
  status: string;
  account_number: string | null;
  batch_id?: string | null;
  reference?: string;
  created_at: string;
  updated_at?: string;
}

export interface RiderBank {
  id: string;
  account_number: string;
  bank_code: string;
  account_name: string | null;
  verified_at: string | null;
  created_at: string;
}

export const MIN_PAYOUT_NAIRA = 50;

/** Next automatic settlement run (00:00 / 18:00 Africa/Lagos), human-readable. */
export function getNextSettlementLabel(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  // Runs at 00:00 and 18:00 WAT: before 18:00 the next run is today 6 PM,
  // otherwise it is midnight tonight.
  return hour < 18 ? 'Today, 6:00 PM WAT' : 'Tonight, 12:00 AM WAT';
}

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
  const [riderBanks, setRiderBanks] = useState<RiderBank[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayGross, setTodayGross] = useState(0);
  const [todayCommission, setTodayCommission] = useState(0);
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
      const [{ data, error }, { data: payouts }, { data: banks }] = await Promise.all([
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
          .select('id, amount, amount_kobo, status, account_number, batch_id, reference, created_at, updated_at')
          .eq('rider_id', user.id)
          .order('created_at', { ascending: false }),
        (supabase as any)
          .from('rider_banks')
          .select('id, account_number, bank_code, account_name, verified_at, created_at')
          .eq('rider_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (error) throw error;

      setEarnings((data || []) as Earning[]);
      setPayoutRequests((payouts || []) as RiderPayoutRequest[]);
      setRiderBanks((banks || []) as RiderBank[]);

      const total = data?.reduce((sum, earning) => sum + earning.net_amount, 0) || 0;
      setTotalBalance(total);

      const today = new Date().toISOString().split('T')[0];
      const todays = data?.filter(e => e.created_at.startsWith(today)) || [];
      const todayTotal = todays.reduce((sum, earning) => sum + earning.net_amount, 0) || 0;
      setTodayEarnings(todayTotal);
      setTodayGross(todays.reduce((sum, e) => sum + Number(e.gross_amount || 0), 0));
      setTodayCommission(todays.reduce((sum, e) => sum + Number(e.ridely_fee || 0), 0));

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

  // Reserved in a scheduled batch but not yet confirmed by the provider.
  const reservedAmount = earnings
    .filter((e) => (e.status as string) === 'paid')
    .reduce((sum, e) => sum + Number(e.net_amount || 0), 0);

  const inTransitAmount = payoutRequests
    .filter((p) => p.status === 'initiated' || p.status === 'transfer_pending')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const paidOutAmount = payoutRequests
    .filter((p) => p.status === 'transfer_success')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const hasBankOnFile = riderBanks.some((b) => !!b.verified_at);
  const verifiedBank = riderBanks.find((b) => !!b.verified_at) ?? null;

  return {
    earnings,
    payoutRequests,
    riderBanks,
    verifiedBank,
    hasBankOnFile,
    totalBalance,
    todayEarnings,
    todayGross,
    todayCommission,
    weeklyEarnings,
    monthlyEarnings,
    availableAmount,
    reservedAmount,
    inTransitAmount,
    paidOutAmount,
    nextSettlementLabel: getNextSettlementLabel(),
    loading,
    refetch: fetchEarnings,
  };
}

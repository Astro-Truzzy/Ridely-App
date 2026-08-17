import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { withRetry } from '@/lib/retry';
import { isRiderActiveStatus } from '@/lib/screenContracts';

export interface Delivery {
  id: string;
  rider_id: string | null;
  user_id: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  share_token?: string;
  proof_photo_path?: string | null;
  parcel_size: 'small' | 'medium' | 'large';
  status: 'pending' | 'rider_assigned' | 'accepted' | 'picked_up' | 'in_transit' | 'nearby' | 'delivered' | 'completed' | 'cancelled' | 'cancelled_no_rider';
  total_cost: number;
  distance: number;
  estimated_time: string;
  delivery_time: 'now' | 'scheduled';
  scheduled_time: string | null;
  payment_method?: 'cash' | 'card' | 'wallet';
  payment_status?: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
  payment_reference?: string | null;
  amount_paid?: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export type CreateDeliveryInput = {
  pickup_address: string;
  dropoff_address: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  parcel_size: 'small' | 'medium' | 'large';
  total_cost: number;
  distance: number;
  estimated_time?: string;
  delivery_time: 'now' | 'scheduled';
  scheduled_time?: string | null;
  payment_method: 'cash' | 'card';
  payment_reference?: string | null;
};

type DeliveryChangePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Delivery | Record<string, never>;
  old: Partial<Delivery>;
};

/** Merge a single realtime change into the current list, keeping it sorted by created_at desc. */
function applyDeliveryChange(prev: Delivery[], payload: DeliveryChangePayload): Delivery[] {
  if (payload.eventType === 'DELETE') {
    const removedId = payload.old?.id;
    return removedId ? prev.filter((d) => d.id !== removedId) : prev;
  }

  const row = payload.new as Delivery;
  if (!row?.id) return prev;

  const exists = prev.some((d) => d.id === row.id);
  const next = exists
    ? prev.map((d) => (d.id === row.id ? { ...d, ...row } : d))
    : [row, ...prev];

  return next.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function useDeliveries() {
  const { user, userType } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && userType) {
      fetchDeliveries();

      // Realtime: patch the single changed row in place instead of refetching
      // the whole list. deliveries is in the supabase_realtime publication.
      const subscription = supabase
        .channel('deliveries')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deliveries',
            filter: userType === 'rider' ? `rider_id=eq.${user.id}` : `user_id=eq.${user.id}`,
          },
          (payload: {
            eventType: 'INSERT' | 'UPDATE' | 'DELETE';
            new: Delivery | Record<string, never>;
            old: Partial<Delivery>;
          }) => {
            setDeliveries((prev) => applyDeliveryChange(prev, payload));
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user, userType]);

  const fetchDeliveries = async () => {
    if (!user || !userType) return;

    try {
      const data = await withRetry(async () => {
        let query = supabase.from('deliveries').select('*');

        if (userType === 'rider') {
          query = query.eq('rider_id', user.id);
        } else {
          query = query.eq('user_id', user.id);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        return data;
      });

      setDeliveries(data || []);
    } catch (error) {
      console.error('Error fetching deliveries:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDelivery = async (deliveryData: CreateDeliveryInput) => {
    if (!user) throw new Error('User not authenticated');

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('You must be logged in to create a booking');

    const { data, error } = await supabase.functions.invoke('create-delivery', {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      },
      body: deliveryData,
    });

    if (error) {
      let message = error.message || 'Failed to create booking';
      if (error instanceof Error && 'context' in error) {
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx) {
            const body = await ctx.json();
            if (body?.error) message = String(body.error);
          }
        } catch {
          // ignore
        }
      }
      throw new Error(message);
    }

    const result = data as { delivery?: Delivery; error?: string } | null;
    if (result?.error) throw new Error(result.error);
    if (!result?.delivery) throw new Error('No delivery returned');
    return result.delivery;
  };

  const updateDeliveryStatus = async (deliveryId: string, status: Delivery['status']) => {
    const updates: any = { status };
    
    if (status === 'delivered') {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('deliveries')
      .update(updates)
      .eq('id', deliveryId);

    if (error) throw error;
  };

  const acceptDelivery = async (deliveryId: string) => {
    if (!user || userType !== 'rider') throw new Error('Only riders can accept deliveries');

    const alreadyActive = deliveries.some((d) => isRiderActiveStatus(d.status));
    if (alreadyActive) {
      throw new Error('You already have an active delivery. Complete it before accepting another.');
    }

    const { data, error } = await supabase.rpc('accept_delivery', {
      p_delivery_id: deliveryId,
    });

    if (error) {
      const msg = error.message || 'Failed to accept delivery';
      if (/verified/i.test(msg)) {
        throw new Error(
          'You must be verified to accept deliveries. Go to Profile → Apply for verification and submit your documents.'
        );
      }
      if (/already accepted|not available/i.test(msg)) {
        throw new Error('Delivery already accepted.');
      }
      throw new Error(msg);
    }
    if (!data) {
      throw new Error('Delivery already accepted.');
    }
  };

  return {
    deliveries,
    loading,
    createDelivery,
    updateDeliveryStatus,
    acceptDelivery,
    refetch: fetchDeliveries,
  };
}
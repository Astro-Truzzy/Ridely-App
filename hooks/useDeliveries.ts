import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface Delivery {
  id: string;
  rider_id: string | null;
  user_id: string;
  pickup_address: string;
  dropoff_address: string;
  parcel_size: 'small' | 'medium' | 'large';
  status: 'pending' | 'rider_assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  total_cost: number;
  distance: number;
  estimated_time: string;
  delivery_time: 'now' | 'scheduled';
  scheduled_time: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export function useDeliveries() {
  const { user, userType } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && userType) {
      fetchDeliveries();
      
      // Subscribe to real-time updates
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
          () => {
            fetchDeliveries();
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
      let query = supabase.from('deliveries').select('*');
      
      if (userType === 'rider') {
        query = query.eq('rider_id', user.id);
      } else {
        query = query.eq('user_id', user.id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setDeliveries(data || []);
    } catch (error) {
      console.error('Error fetching deliveries:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDelivery = async (deliveryData: Omit<Delivery, 'id' | 'created_at' | 'updated_at' | 'completed_at' | 'rider_id' | 'status'>) => {
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('deliveries')
      .insert({
        ...deliveryData,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
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

    const { error } = await supabase
      .from('deliveries')
      .update({
        rider_id: user.id,
        status: 'rider_assigned',
      })
      .eq('id', deliveryId);

    if (error) throw error;
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
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface DeliveryRatingRow {
  id: string;
  delivery_id: string;
  user_id: string;
  rider_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
}

export function useDeliveryRatings() {
  const { user } = useAuth();
  const [ratingsByDeliveryId, setRatingsByDeliveryId] = useState<Record<string, DeliveryRatingRow>>({});
  const [loading, setLoading] = useState(true);

  const fetchRatings = useCallback(async () => {
    if (!user?.id) {
      setRatingsByDeliveryId({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('delivery_ratings')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      const byId: Record<string, DeliveryRatingRow> = {};
      (data || []).forEach((row: DeliveryRatingRow) => {
        byId[row.delivery_id] = row;
      });
      setRatingsByDeliveryId(byId);
    } catch (e) {
      console.error('Failed to fetch delivery ratings', e);
      setRatingsByDeliveryId({});
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchRatings();
  }, [fetchRatings]);

  const submitRating = useCallback(
    async (deliveryId: string, riderId: string, rating: number, reviewText?: string) => {
      if (!user?.id) throw new Error('You must be signed in to rate.');
      if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5.');
      const { error } = await (supabase as any)
        .from('delivery_ratings')
        .insert({
          delivery_id: deliveryId,
          user_id: user.id,
          rider_id: riderId,
          rating,
          review_text: reviewText?.trim() || null,
        });
      if (error) throw error;
      await fetchRatings();
    },
    [user?.id, fetchRatings]
  );

  const getRatingForDelivery = useCallback(
    (deliveryId: string): DeliveryRatingRow | null => ratingsByDeliveryId[deliveryId] ?? null,
    [ratingsByDeliveryId]
  );

  const hasRated = useCallback(
    (deliveryId: string): boolean => !!ratingsByDeliveryId[deliveryId],
    [ratingsByDeliveryId]
  );

  return {
    ratingsByDeliveryId,
    loading,
    submitRating,
    getRatingForDelivery,
    hasRated,
    refetch: fetchRatings,
  };
}

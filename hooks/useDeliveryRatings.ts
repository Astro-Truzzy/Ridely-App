import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['delivery_ratings', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('delivery_ratings')
        .select('*')
        .eq('user_id', user!.id);
      if (error) throw error;
      const byId: Record<string, DeliveryRatingRow> = {};
      (data || []).forEach((row: DeliveryRatingRow) => {
        byId[row.delivery_id] = row;
      });
      return byId;
    },
  });

  const ratingsByDeliveryId = query.data ?? {};

  const submitRating = useCallback(
    async (deliveryId: string, riderId: string, rating: number, reviewText?: string) => {
      if (!user?.id) throw new Error('You must be signed in to rate.');
      if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5.');
      const { error } = await (supabase as any).from('delivery_ratings').insert({
        delivery_id: deliveryId,
        user_id: user.id,
        rider_id: riderId,
        rating,
        review_text: reviewText?.trim() || null,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['delivery_ratings', user.id] });
    },
    [user?.id, qc]
  );

  const getRatingForDelivery = useCallback(
    (deliveryId: string): DeliveryRatingRow | null => ratingsByDeliveryId[deliveryId] ?? null,
    [ratingsByDeliveryId]
  );

  const hasRated = useCallback(
    (deliveryId: string): boolean => !!ratingsByDeliveryId[deliveryId],
    [ratingsByDeliveryId]
  );

  const { refetch: rqRefetch } = query;
  const refetch = useCallback(async () => {
    await rqRefetch();
  }, [rqRefetch]);

  return {
    ratingsByDeliveryId,
    loading: query.isLoading,
    submitRating,
    getRatingForDelivery,
    hasRated,
    refetch,
  };
}

import { QueryClient } from '@tanstack/react-query';

/**
 * Shared query cache for plain read data (payment methods, wallet, saved
 * addresses, ratings). Live/realtime lists (deliveries, jobs, notifications)
 * are intentionally NOT managed here — they use Supabase realtime hooks.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Serve cached data instantly on navigation, refetch in the background
      // once it's older than this.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

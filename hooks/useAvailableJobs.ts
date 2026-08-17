import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { rejectDelivery, fetchRejectedDeliveryIds } from '@/lib/deliveryRejections';
import { withRetry } from '@/lib/retry';

export interface AvailableJob {
  id: string;
  user_id: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  parcel_size: 'small' | 'medium' | 'large';
  total_cost: number;
  distance: number;
  estimated_time: string;
  delivery_time: 'now' | 'scheduled';
  scheduled_time: string | null;
  created_at: string;
  status?: string;
  rider_id?: string | null;
  users?: {
    full_name: string;
  };
}

const JOB_SELECT = `
  *,
  users:user_id (
    full_name
  )
`;

// Shared across hook instances so the delivery modal can reuse jobs already
// loaded on the rider dashboard without a second round-trip.
const availableJobsCache = new Map<string, AvailableJob>();
let cacheVersion = 0;
const cacheListeners = new Set<(version: number) => void>();

function bumpAvailableJobsCache() {
  cacheVersion += 1;
  cacheListeners.forEach((listener) => listener(cacheVersion));
}

function syncAvailableJobsCache(jobs: AvailableJob[]) {
  availableJobsCache.clear();
  jobs.forEach((job) => availableJobsCache.set(job.id, job));
  bumpAvailableJobsCache();
}

function removeCachedAvailableJob(id: string) {
  if (availableJobsCache.delete(id)) bumpAvailableJobsCache();
}

export function getCachedAvailableJob(id: string) {
  return availableJobsCache.get(id);
}

export function useAvailableJobCacheVersion() {
  const [version, setVersion] = useState(cacheVersion);

  useEffect(() => {
    const listener = (nextVersion: number) => setVersion(nextVersion);
    cacheListeners.add(listener);
    return () => {
      cacheListeners.delete(listener);
    };
  }, []);

  return version;
}

export function useAvailableJobs() {
  const { user, userType } = useAuth();
  const [jobs, setJobs] = useState<AvailableJob[]>([]);
  const [loading, setLoading] = useState(true);
  const rejectedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (user && userType === 'rider') {
      fetchAvailableJobs();

      // Realtime: patch the list per-event instead of refetching everything.
      // - Removals (job taken/cancelled/deleted) apply instantly with no query.
      // - Additions fetch just the one row (with the customer name join).
      const subscription = supabase
        .channel('available_jobs')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deliveries',
          },
          (payload: {
            eventType: 'INSERT' | 'UPDATE' | 'DELETE';
            new: { id?: string; status?: string; rider_id?: string | null };
            old: { id?: string };
          }) => {
            handleRealtimeChange(payload);
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user, userType]);

  const isAvailable = (row: { status?: string; rider_id?: string | null }) =>
    row.status === 'pending' && (row.rider_id === null || row.rider_id === undefined);

  const handleRealtimeChange = async (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: { id?: string; status?: string; rider_id?: string | null };
    old: { id?: string };
  }) => {
    if (payload.eventType === 'DELETE') {
      const id = payload.old?.id;
      if (id) {
        removeCachedAvailableJob(id);
        setJobs((prev) => prev.filter((j) => j.id !== id));
      }
      return;
    }

    const row = payload.new;
    const id = row?.id;
    if (!id) return;

    // No longer an open job (accepted, cancelled, rejected by this rider) → remove.
    if (!isAvailable(row) || rejectedIdsRef.current.has(id)) {
      removeCachedAvailableJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      return;
    }

    // Newly available and not already shown → fetch the single row with the name.
    setJobs((prev) => {
      if (prev.some((j) => j.id === id)) return prev;
      // Fire the enrichment fetch; state updates when it resolves.
      addJobById(id);
      return prev;
    });
  };

  const addJobById = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select(JOB_SELECT)
        .eq('id', id)
        .eq('status', 'pending')
        .is('rider_id', null)
        .maybeSingle();
      if (error || !data) return;
      const job = data as AvailableJob;
      if (rejectedIdsRef.current.has(job.id)) return;
      setJobs((prev) => {
        if (prev.some((j) => j.id === job.id)) return prev;
        const next = [job, ...prev].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        syncAvailableJobsCache(next);
        return next;
      });
    } catch (e) {
      console.error('Error adding realtime job:', e);
    }
  };

  const fetchAvailableJobs = async () => {
    if (!user || userType !== 'rider') return;

    try {
      const [data, rejectedIds] = await Promise.all([
        withRetry(async () => {
          const { data, error } = await supabase
            .from('deliveries')
            .select(JOB_SELECT)
            .eq('status', 'pending')
            .is('rider_id', null)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return data;
        }),
        fetchRejectedDeliveryIds(user.id).catch(() => [] as string[]),
      ]);

      const rejectedSet = new Set(rejectedIds);
      rejectedIdsRef.current = rejectedSet;
      const nextJobs = (data || []).filter((job: AvailableJob) => !rejectedSet.has(job.id));
      syncAvailableJobsCache(nextJobs);
      setJobs(nextJobs);
    } catch (error) {
      console.error('Error fetching available jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const rejectJob = async (deliveryId: string) => {
    if (!user || userType !== 'rider') return;
    // Optimistically remove from the list, then persist the rejection.
    rejectedIdsRef.current.add(deliveryId);
    removeCachedAvailableJob(deliveryId);
    setJobs((prev) => prev.filter((job) => job.id !== deliveryId));
    try {
      await rejectDelivery(user.id, deliveryId);
    } catch (error) {
      console.error('Error rejecting job:', error);
      rejectedIdsRef.current.delete(deliveryId);
      await fetchAvailableJobs();
      throw error;
    }
  };

  /** Remove a job locally without persisting a rejection (e.g. right after accepting it). */
  const removeJob = (deliveryId: string) => {
    removeCachedAvailableJob(deliveryId);
    setJobs((prev) => prev.filter((job) => job.id !== deliveryId));
  };

  return {
    jobs,
    loading,
    refetch: fetchAvailableJobs,
    rejectJob,
    removeJob,
  };
}

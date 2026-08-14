import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MapPin, Package, Bike, CheckCircle } from 'lucide-react-native';

const POLL_MS = 10_000;

type TrackingData = {
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  estimatedTime: string | null;
  riderName: string | null;
  riderLat: number | null;
  riderLng: number | null;
  proofPhotoUrl: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Finding a rider',
  accepted: 'Rider on the way',
  rider_assigned: 'Rider on the way',
  picked_up: 'Package picked up',
  in_transit: 'On the way',
  nearby: 'Almost there',
  delivered: 'Delivered',
  completed: 'Delivered',
  cancelled: 'Cancelled',
  cancelled_no_rider: 'Cancelled',
};

function firstNameOnly(name: string | null): string | null {
  if (!name) return null;
  const first = name.trim().split(/\s+/)[0];
  return first || null;
}

function getStaticMapUrl(data: TrackingData): string | null {
  const apiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY;
  if (!apiKey) return null;

  const markers: string[] = [];
  if (data.pickupLat != null && data.pickupLng != null) {
    markers.push(`color:green|label:P|${data.pickupLat},${data.pickupLng}`);
  }
  if (data.dropoffLat != null && data.dropoffLng != null) {
    markers.push(`color:red|label:D|${data.dropoffLat},${data.dropoffLng}`);
  }
  if (data.riderLat != null && data.riderLng != null) {
    markers.push(`color:blue|label:R|${data.riderLat},${data.riderLng}`);
  }
  if (markers.length === 0) return null;

  const markerParam = markers.map((m) => `markers=${encodeURIComponent(m)}`).join('&');
  return `https://maps.googleapis.com/maps/api/staticmap?size=640x420&scale=2&${markerParam}&key=${apiKey}`;
}

export default function PublicTrackingPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTracking = useCallback(async () => {
    if (!token) return;
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
    if (!supabaseUrl) {
      setError('Tracking service unavailable');
      setLoading(false);
      return;
    }
    try {
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/public-tracking?token=${encodeURIComponent(token)}`,
        {
          headers: anonKey ? { Authorization: `Bearer ${anonKey}` } : {},
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Failed to load tracking');
      }
      const json = (await res.json()) as TrackingData;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tracking');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchTracking]);

  const mapUrl = data ? getStaticMapUrl(data) : null;
  const isDelivered = data?.status === 'delivered' || data?.status === 'completed';
  const isCancelled = data?.status === 'cancelled' || data?.status === 'cancelled_no_rider';
  const riderFirst = firstNameOnly(data?.riderName ?? null);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#174AFF" />
        <Text style={styles.loadingText}>Loading delivery…</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Package size={48} color="#9CA3AF" />
        <Text style={styles.errorTitle}>Tracking unavailable</Text>
        <Text style={styles.errorText}>{error ?? 'This link may be invalid or expired.'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.mapWrap}>
        {mapUrl ? (
          <Image source={{ uri: mapUrl }} style={styles.map} resizeMode="cover" />
        ) : (
          <View style={[styles.map, styles.mapPlaceholder]}>
            <MapPin size={32} color="#9CA3AF" />
            <Text style={styles.mapPlaceholderText}>Map preview unavailable</Text>
          </View>
        )}
        <View style={styles.brandChip}>
          <Text style={styles.brandChipText}>Ridely</Text>
        </View>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.handle} />

        <View style={styles.statusBlock}>
          {isDelivered ? (
            <CheckCircle size={36} color="#10B981" />
          ) : isCancelled ? (
            <Package size={36} color="#EF4444" />
          ) : (
            <Bike size={36} color="#174AFF" />
          )}
          <Text style={styles.statusLabel}>{STATUS_LABELS[data.status] ?? data.status}</Text>
          {riderFirst && !isDelivered && !isCancelled ? (
            <Text style={styles.riderName}>{riderFirst} is handling this delivery</Text>
          ) : null}
          {data.estimatedTime && !isDelivered && !isCancelled ? (
            <Text style={styles.eta}>ETA {data.estimatedTime}</Text>
          ) : null}
        </View>

        <View style={styles.addressCard}>
          <View style={styles.addressRow}>
            <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
            <View style={styles.addressTextWrap}>
              <Text style={styles.addressLabel}>Pickup</Text>
              <Text style={styles.addressText}>{data.pickupAddress}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.addressRow}>
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            <View style={styles.addressTextWrap}>
              <Text style={styles.addressLabel}>Dropoff</Text>
              <Text style={styles.addressText}>{data.dropoffAddress}</Text>
            </View>
          </View>
        </View>

        {data.proofPhotoUrl ? (
          <View style={styles.proofCard}>
            <Text style={styles.proofTitle}>Proof of delivery</Text>
            <Image source={{ uri: data.proofPhotoUrl }} style={styles.proofImage} resizeMode="cover" />
          </View>
        ) : null}

        <Text style={styles.footer}>Live updates · Powered by Ridely</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F3F4F6' },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F3F4F6',
  },
  loadingText: { marginTop: 16, color: '#6B7280', fontSize: 15 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 16 },
  errorText: { fontSize: 15, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  mapWrap: { height: Platform.OS === 'web' ? 360 : 280, backgroundColor: '#E5E7EB' },
  map: { width: '100%', height: '100%' },
  mapPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  mapPlaceholderText: { color: '#9CA3AF', marginTop: 8, fontSize: 14 },
  brandChip: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 48,
    left: 16,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  brandChipText: { fontSize: 13, fontWeight: '800', color: '#174AFF' },
  sheet: {
    flex: 1,
    marginTop: -24,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginTop: 12,
    marginBottom: 20,
  },
  statusBlock: { alignItems: 'center', marginBottom: 24 },
  statusLabel: {
    marginTop: 12,
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  riderName: { marginTop: 8, fontSize: 16, color: '#4B5563', textAlign: 'center' },
  eta: { marginTop: 6, fontSize: 18, fontWeight: '700', color: '#174AFF' },
  addressCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  addressTextWrap: { flex: 1 },
  addressLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase' },
  addressText: { fontSize: 15, color: '#111827', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },
  proofCard: { marginBottom: 16 },
  proofTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  proofImage: { width: '100%', height: 220, borderRadius: 12 },
  footer: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 8 },
});

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
  pending: 'Searching for a rider',
  accepted: 'Rider assigned',
  rider_assigned: 'Rider assigned',
  picked_up: 'Package picked up',
  in_transit: 'In transit',
  nearby: 'Rider nearby',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  cancelled_no_rider: 'Cancelled',
};

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
  return `https://maps.googleapis.com/maps/api/staticmap?size=600x300&scale=2&${markerParam}&key=${apiKey}`;
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#174AFF" />
        <Text style={styles.loadingText}>Loading delivery tracking…</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Package size={48} color="#9CA3AF" />
        <Text style={styles.errorTitle}>Tracking unavailable</Text>
        <Text style={styles.errorText}>{error ?? 'Link may be invalid or expired.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.brand}>Ridely</Text>
        <Text style={styles.subtitle}>Live delivery tracking</Text>
      </View>

      <View style={styles.statusCard}>
        {isDelivered ? (
          <CheckCircle size={28} color="#10B981" />
        ) : (
          <Bike size={28} color="#174AFF" />
        )}
        <View style={styles.statusInfo}>
          <Text style={styles.statusLabel}>{STATUS_LABELS[data.status] ?? data.status}</Text>
          {data.riderName && !isDelivered && (
            <Text style={styles.riderName}>Rider: {data.riderName}</Text>
          )}
          {data.estimatedTime && (
            <Text style={styles.eta}>ETA: {data.estimatedTime}</Text>
          )}
        </View>
      </View>

      {mapUrl ? (
        <Image source={{ uri: mapUrl }} style={styles.map} resizeMode="cover" />
      ) : (
        <View style={[styles.map, styles.mapPlaceholder]}>
          <MapPin size={32} color="#9CA3AF" />
          <Text style={styles.mapPlaceholderText}>Map preview unavailable</Text>
        </View>
      )}

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

      {data.proofPhotoUrl && (
        <View style={styles.proofCard}>
          <Text style={styles.proofTitle}>Proof of delivery</Text>
          <Image source={{ uri: data.proofPhotoUrl }} style={styles.proofImage} resizeMode="cover" />
        </View>
      )}

      <Text style={styles.footer}>
        Updates every {POLL_MS / 1000}s · Powered by Ridely
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 20, paddingTop: Platform.OS === 'web' ? 40 : 20, maxWidth: 640, alignSelf: 'center', width: '100%' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#F9FAFB' },
  loadingText: { marginTop: 16, color: '#6B7280', fontSize: 15 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 16 },
  errorText: { fontSize: 15, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  header: { marginBottom: 20 },
  brand: { fontSize: 28, fontWeight: '800', color: '#174AFF' },
  subtitle: { fontSize: 15, color: '#6B7280', marginTop: 4 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statusInfo: { flex: 1 },
  statusLabel: { fontSize: 18, fontWeight: '700', color: '#111827' },
  riderName: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  eta: { fontSize: 13, color: '#174AFF', marginTop: 4, fontWeight: '600' },
  map: { width: '100%', height: 200, borderRadius: 16, marginBottom: 16, backgroundColor: '#E5E7EB' },
  mapPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  mapPlaceholderText: { color: '#9CA3AF', marginTop: 8, fontSize: 14 },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  addressTextWrap: { flex: 1 },
  addressLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase' },
  addressText: { fontSize: 15, color: '#111827', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  proofCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  proofTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  proofImage: { width: '100%', height: 220, borderRadius: 12 },
  footer: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginBottom: 24 },
});

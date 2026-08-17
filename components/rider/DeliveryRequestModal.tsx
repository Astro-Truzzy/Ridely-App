import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Vibration,
} from 'react-native';
import { MapPin, Navigation } from 'lucide-react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useAvailableJobCacheVersion, getCachedAvailableJob, type AvailableJob } from '@/hooks/useAvailableJobs';
import { rejectDelivery } from '@/lib/deliveryRejections';
import { withRetry } from '@/lib/retry';
import { tapLight, notifyWarning, notifySuccess, tapMedium } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { buildRiderJobPayload, isRiderActiveStatus } from '@/lib/screenContracts';

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 32, 400);
const OFFER_SECONDS = 25;
const RIDER_CUT = 0.85;

interface DeliveryRequestModalProps {
  visible: boolean;
  deliveryId: string | null;
  onClose: () => void;
}

interface DeliveryDetails {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  parcel_size: string;
  total_cost: number;
  distance: number;
  estimated_time: string;
  status: string;
  rider_id: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  users?: { full_name?: string } | null;
}

const DELIVERY_SELECT = `
  id,
  pickup_address,
  dropoff_address,
  parcel_size,
  total_cost,
  distance,
  estimated_time,
  status,
  rider_id,
  pickup_lat,
  pickup_lng,
  dropoff_lat,
  dropoff_lng,
  users:user_id ( full_name )
`;

function jobToDeliveryDetails(job: AvailableJob): DeliveryDetails {
  return {
    id: job.id,
    pickup_address: job.pickup_address,
    dropoff_address: job.dropoff_address,
    parcel_size: job.parcel_size,
    total_cost: job.total_cost,
    distance: job.distance,
    estimated_time: job.estimated_time,
    status: job.status ?? 'pending',
    rider_id: job.rider_id ?? null,
    pickup_lat: job.pickup_lat ?? null,
    pickup_lng: job.pickup_lng ?? null,
    dropoff_lat: job.dropoff_lat ?? null,
    dropoff_lng: job.dropoff_lng ?? null,
    users: job.users ?? null,
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatKm(km: number) {
  if (km < 0.1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function DeliveryRequestModal({ visible, deliveryId, onClose }: DeliveryRequestModalProps) {
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();
  const { showAlert } = useAlert();
  const { deliveries, acceptDelivery } = useDeliveries();
  useAvailableJobCacheVersion();
  const [delivery, setDelivery] = useState<DeliveryDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(OFFER_SECONDS);
  const [pickupKm, setPickupKm] = useState<number | null>(null);
  const fetchIdRef = useRef(0);
  const closedRef = useRef(false);

  const prefetchedJob =
    visible && deliveryId ? getCachedAvailableJob(deliveryId) ?? null : null;

  useEffect(() => {
    closedRef.current = false;
    setSecondsLeft(OFFER_SECONDS);
    setPickupKm(null);
    setAccepting(false);
  }, [visible, deliveryId]);

  useEffect(() => {
    if (!visible || !deliveryId) {
      setDelivery(null);
      setLoading(false);
      return;
    }

    if (prefetchedJob) {
      setDelivery(jobToDeliveryDetails(prefetchedJob));
      setLoading(false);
      return;
    }

    const requestId = ++fetchIdRef.current;
    setLoading(true);

    (async () => {
      try {
        const data = await withRetry(async () => {
          const { data, error } = await supabase
            .from('deliveries')
            .select(DELIVERY_SELECT)
            .eq('id', deliveryId)
            .eq('status', 'pending')
            .is('rider_id', null)
            .maybeSingle();
          if (error) throw error;
          return data;
        });

        if (fetchIdRef.current !== requestId) return;
        setDelivery(data ? (data as DeliveryDetails) : null);
      } catch {
        if (fetchIdRef.current !== requestId) return;
        setDelivery(null);
      } finally {
        if (fetchIdRef.current === requestId) setLoading(false);
      }
    })();
  }, [visible, deliveryId, prefetchedJob]);

  useEffect(() => {
    if (!visible || !delivery) return;
    let cancelled = false;
    (async () => {
      const plat = Number(delivery.pickup_lat);
      const plng = Number(delivery.pickup_lng);
      if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setPickupKm(
          haversineKm(loc.coords.latitude, loc.coords.longitude, plat, plng)
        );
      } catch {
        // Trip distance still shown as fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, delivery?.id, delivery?.pickup_lat, delivery?.pickup_lng]);

  const handleReject = async () => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (deliveryId && user?.id) {
      try {
        await rejectDelivery(user.id, deliveryId);
      } catch {}
    }
    onClose();
  };

  useEffect(() => {
    if (!visible || !delivery || accepting) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          notifyWarning();
          void handleReject();
          return 0;
        }
        if (prev <= 6) {
          notifyWarning();
          Vibration.vibrate(80);
        } else {
          tapLight();
          Vibration.vibrate(30);
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // handleReject is stable enough for the offer lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, delivery?.id, accepting]);

  const handleAccept = async () => {
    if (!deliveryId || !user || !delivery || closedRef.current) return;
    const isVerified =
      (userProfile as { account_verification_status?: string } | null)
        ?.account_verification_status === 'verified';
    if (!isVerified) {
      showAlert(
        'Verification required',
        'You must be verified to accept deliveries. Go to Profile → Apply for verification and submit your documents.'
      );
      onClose();
      return;
    }
    if (deliveries.some((d) => isRiderActiveStatus(d.status))) {
      showAlert(
        'Finish your current delivery',
        'Complete or cancel your active job before accepting another.'
      );
      onClose();
      return;
    }
    setAccepting(true);
    tapMedium();
    try {
      await acceptDelivery(deliveryId);
      notifySuccess();
      const jobData = buildRiderJobPayload({
        id: delivery.id,
        total_cost: delivery.total_cost,
        parcel_size: delivery.parcel_size,
        pickup_address: delivery.pickup_address,
        dropoff_address: delivery.dropoff_address,
        distance: delivery.distance,
        estimated_time: delivery.estimated_time,
        senderName: (delivery.users as { full_name?: string } | null)?.full_name ?? 'Customer',
        pickup_lat: delivery.pickup_lat,
        pickup_lng: delivery.pickup_lng,
        dropoff_lat: delivery.dropoff_lat,
        dropoff_lng: delivery.dropoff_lng,
      });
      closedRef.current = true;
      onClose();
      router.replace({
        pathname: '/(rider)/active-delivery',
        params: { jobId: delivery.id, jobData: JSON.stringify(jobData) },
      });
    } catch (err) {
      setAccepting(false);
      showAlert(
        'Could not accept',
        err instanceof Error ? err.message : 'This job may have already been taken.'
      );
      onClose();
      router.push('/(rider)/dashboard');
    }
  };

  const offerOpen = delivery && delivery.status === 'pending' && !delivery.rider_id;
  const netFare = delivery ? Number(delivery.total_cost) * RIDER_CUT : 0;
  const countdownUrgent = secondsLeft <= 5;
  const pickupLabel =
    pickupKm != null
      ? `${formatKm(pickupKm)} to pickup`
      : delivery
        ? `${delivery.distance} km trip`
        : '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!accepting) void handleReject();
      }}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay}>
        <Pressable
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            theme.shadows.large,
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                Incoming job…
              </Text>
            </View>
          ) : offerOpen ? (
            <>
              <View style={styles.countdownWrap}>
                <Text
                  style={[
                    styles.countdown,
                    { color: countdownUrgent ? theme.colors.error : theme.colors.primary },
                  ]}
                >
                  {secondsLeft}
                </Text>
                <Text style={[styles.countdownLabel, { color: theme.colors.textSecondary }]}>
                  seconds to accept
                </Text>
              </View>

              <Text style={[styles.fare, { color: theme.colors.text }]}>
                ₦{netFare.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
              </Text>
              <Text style={[styles.fareHint, { color: theme.colors.textTertiary }]}>
                Your cut · ₦{Number(delivery.total_cost).toLocaleString('en-NG')} fare
              </Text>

              <View style={[styles.pickupChip, { backgroundColor: theme.colors.background }]}>
                <Navigation size={16} color={theme.colors.primary} strokeWidth={2} />
                <Text style={[styles.pickupChipText, { color: theme.colors.text }]}>{pickupLabel}</Text>
              </View>

              <View style={styles.addressBlock}>
                <View style={styles.addressRow}>
                  <MapPin size={16} color={theme.colors.success} strokeWidth={2} />
                  <Text style={[styles.addressText, { color: theme.colors.text }]} numberOfLines={2}>
                    {delivery.pickup_address}
                  </Text>
                </View>
                <View style={styles.addressRow}>
                  <MapPin size={16} color={theme.colors.error} strokeWidth={2} />
                  <Text style={[styles.addressText, { color: theme.colors.text }]} numberOfLines={2}>
                    {delivery.dropoff_address}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.acceptBtn,
                  { backgroundColor: theme.colors.success },
                ]}
                onPress={handleAccept}
                disabled={accepting}
                activeOpacity={0.9}
              >
                {accepting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.acceptBtnText}>Accept</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.declineBtn}
                onPress={handleReject}
                disabled={accepting}
                hitSlop={8}
              >
                <Text style={[styles.declineBtnText, { color: theme.colors.textTertiary }]}>
                  Decline
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.loadingWrap}>
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                This delivery is no longer available.
              </Text>
              <TouchableOpacity
                style={[styles.dismissBtn, { backgroundColor: theme.colors.primary }]}
                onPress={onClose}
              >
                <Text style={styles.dismissBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 28,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 16,
  },
  loadingWrap: {
    padding: 28,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center',
  },
  dismissBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  dismissBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  countdownWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  countdown: {
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 62,
  },
  countdownLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fare: {
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
  },
  fareHint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 2,
  },
  pickupChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pickupChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  addressBlock: {
    marginTop: 16,
    gap: 10,
    marginBottom: 20,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  acceptBtn: {
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
  },
  declineBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  declineBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

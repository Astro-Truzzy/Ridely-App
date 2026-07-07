import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import {
  ArrowLeft,
  Navigation,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Package,
  CircleCheck as CheckCircle,
  User,
} from 'lucide-react-native';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { AnimatedPressable } from '@/components/rider/AnimatedPressable';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { geocodeAddress, fetchGoogleDirections } from '@/lib/googleDirections';

/**
 * Active Delivery Screen
 * 
 * This screen shows the active delivery information, map, and controls for a rider
 * to complete a delivery job. It handles location tracking, delivery status updates,
 * and communication with the backend.
 */

type DeliveryStatus =
  | 'heading_to_pickup'
  | 'at_pickup'
  | 'picked_up'
  | 'heading_to_dropoff'
  | 'at_dropoff'
  | 'delivered';

const DEFAULT_DELTA = { latitudeDelta: 0.05, longitudeDelta: 0.05 };

function getZoomForSpeed(speedKmh: number): number {
  if (speedKmh < 10) return 16.8;
  if (speedKmh < 25) return 15.8;
  if (speedKmh < 45) return 14.8;
  return 13.8;
}

export default function ActiveDeliveryScreen() {
  const [RNMaps, setRNMaps] = useState<{
    default: React.ComponentType<any>;
    Marker: React.ComponentType<any>;
    Polyline: React.ComponentType<any>;
  } | null>(null);

  // Load react-native-maps only in dev builds; Expo Go has no native maps module (RNMapsAirModule)
  useEffect(() => {
    let mounted = true;
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) {
      setRNMaps(null);
      return;
    }
    import('react-native-maps')
      .then((maps) => {
        if (mounted) setRNMaps({
          default: maps.default as unknown as React.ComponentType<any>,
          Marker: maps.Marker as unknown as React.ComponentType<any>,
          Polyline: maps.Polyline as unknown as React.ComponentType<any>,
        });
      })
      .catch(() => {
        if (mounted) setRNMaps(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const [riderCoords, setRiderCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [pickupCoordsState, setPickupCoordsState] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dropoffCoordsState, setDropoffCoordsState] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const didInitialFitRef = useRef(false);
  const [followMode, setFollowMode] = useState(true);
  const [riderSpeedKmh, setRiderSpeedKmh] = useState(0);
  const lastSpeedSampleRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);

  const lastSentLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const MIN_MOVEMENT_METERS = 20;

  const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Watch and update rider's own location: throttle 3–5s, only write when movement > 20m; dual write rider_locations + riders.location
  useEffect(() => {
    let locationSubscription: { remove: () => void } | undefined;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 4000,
          distanceInterval: 20,
        },
        async (loc) => {
          const { latitude, longitude } = loc.coords;
          setRiderCoords({ latitude, longitude });

          const now = Date.now();
          const prev = lastSpeedSampleRef.current;
          if (prev) {
            const meters = haversineMeters(prev.lat, prev.lng, latitude, longitude);
            const seconds = Math.max((now - prev.ts) / 1000, 1);
            const kmh = (meters / seconds) * 3.6;
            setRiderSpeedKmh((old) => old * 0.7 + Math.min(kmh, 120) * 0.3);
          }
          lastSpeedSampleRef.current = { lat: latitude, lng: longitude, ts: now };

          const last = lastSentLocationRef.current;
          const shouldWrite =
            last === null ||
            haversineMeters(last.lat, last.lng, latitude, longitude) >= MIN_MOVEMENT_METERS;

          if (!shouldWrite) return;

          lastSentLocationRef.current = { lat: latitude, lng: longitude };

          await supabase
            .from('rider_locations')
            .upsert({
              rider_id: user.id,
              latitude,
              longitude,
              updated_at: new Date().toISOString(),
            } as never);

          await (supabase as any).rpc('update_rider_location', { lat: latitude, lng: longitude });
        }
      );
    })();
    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, []);

  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { jobId, jobData } = useLocalSearchParams<{
    jobId: string;
    jobData: string;
  }>();
  const [delivery, setDelivery] = useState<{ id: string; status: string } | null>(() =>
    jobId ? { id: jobId, status: 'accepted' } : null
  );
  const [routeTarget, setRouteTarget] = useState<'pickup' | 'dropoff' | null>('pickup');
  const [deliveryStatus, setDeliveryStatus] =
    useState<DeliveryStatus>('heading_to_pickup');
  const [deliveryOTP, setDeliveryOTP] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [confirming, setConfirming] = useState(false);

  const job = jobData ? JSON.parse(jobData) : null;

  // Geocode pickup and dropoff addresses (like user tracking screen)
  useEffect(() => {
    if (!job?.pickupAddress || !job?.dropoffAddress) return;
    let cancelled = false;
    (async () => {
      const [pickup, dropoff] = await Promise.all([
        geocodeAddress(job.pickupAddress),
        geocodeAddress(job.dropoffAddress),
      ]);
      if (cancelled) return;
      if (pickup) setPickupCoordsState(pickup);
      if (dropoff) setDropoffCoordsState(dropoff);
    })();
    return () => { cancelled = true; };
  }, [job?.pickupAddress, job?.dropoffAddress]);

  // Fetch route from rider to current target (pickup or dropoff), debounced
  const riderCoordsRef = useRef(riderCoords);
  const deliveryStatusRef = useRef(deliveryStatus);
  riderCoordsRef.current = riderCoords;
  deliveryStatusRef.current = deliveryStatus;
  const routeFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const rider = riderCoordsRef.current;
    const status = deliveryStatusRef.current;
    const pickup = pickupCoordsState;
    const dropoff = dropoffCoordsState;
    if (!rider || (!pickup && !dropoff)) return;

    const destination = (status === 'picked_up' || status === 'heading_to_dropoff' || status === 'at_dropoff') ? dropoff : pickup;
    if (!destination) return;

    const fetchRoute = async () => {
      const result = await fetchGoogleDirections(
        rider.latitude,
        rider.longitude,
        destination.latitude,
        destination.longitude
      );
      if (result?.coordinates?.length) setRouteCoordinates(result.coordinates);
    };

    if (routeFetchRef.current) clearTimeout(routeFetchRef.current);
    routeFetchRef.current = setTimeout(() => {
      routeFetchRef.current = null;
      fetchRoute();
    }, 800);

    return () => {
      if (routeFetchRef.current) clearTimeout(routeFetchRef.current);
    };
  }, [riderCoords?.latitude, riderCoords?.longitude, pickupCoordsState, dropoffCoordsState, deliveryStatus]);

  useEffect(() => {
    if (!jobId) return;
    const fetchDelivery = async () => {
      const { data } = await (supabase as any).from('deliveries').select('id, status').eq('id', jobId).maybeSingle();
      if (data) setDelivery({ id: data.id, status: data.status });
    };
    fetchDelivery();

    const channel = supabase
      .channel(`delivery-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'deliveries', filter: `id=eq.${jobId}` },
        (payload: { new: { id?: string; status?: string } }) => {
          const next = payload.new;
          if (next?.id != null && next?.status != null) setDelivery({ id: next.id, status: next.status });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  useEffect(() => {
    if (!delivery) return;
    const s = delivery.status;
    if (s === 'accepted' || s === 'rider_assigned') {
      setRouteTarget('pickup');
      setDeliveryStatus('at_pickup');
    } else if (s === 'picked_up') {
      setRouteTarget('dropoff');
      setDeliveryStatus('at_dropoff');
    } else if (s === 'delivered' || s === 'completed') {
      setRouteTarget(null);
      setDeliveryStatus('delivered');
    }
  }, [delivery?.status]);

  useEffect(() => {
    if (delivery?.status === 'delivered' || delivery?.status === 'completed') {
      showAlert(
        'Delivery Completed',
        `You've earned ₦${job?.reward ?? 0}!\n\nNet earnings: ₦${(((job?.reward ?? 0) * 0.85)).toFixed(2)} (after 15% platform fee)\n\nThank you for using Ridely!`,
        [
          { text: 'View Earnings', onPress: () => router.replace('/(rider)/earnings') },
          { text: 'Back to Dashboard', onPress: () => router.replace('/(rider)/dashboard') },
        ]
      );
    }
  }, [delivery?.status]);

  const handleConfirmPickup = async () => {
    if (!jobId || !user) return;
    setConfirming(true);
    try {
      const { data, error } = await (supabase as any)
        .from('deliveries')
        .update({ status: 'picked_up' })
        .eq('id', jobId)
        .eq('status', 'accepted')
        .select('user_id');
      if (error) throw error;
      let customerUserId: string | null = data?.[0]?.user_id ?? null;
      if (!data?.length) {
        const { data: d2 } = await (supabase as any).from('deliveries').update({ status: 'picked_up' }).eq('id', jobId).eq('status', 'rider_assigned').select('user_id');
        if (!d2?.length) {
          showAlert('Error', 'Invalid state. Cannot confirm pickup.');
          return;
        }
        customerUserId = d2[0]?.user_id ?? null;
      }
      if (customerUserId) {
        await (supabase as any).from('notifications').insert({
          user_id: customerUserId,
          rider_id: null,
          type: 'delivery_update',
          title: 'Rider picked up your package',
          message: 'Your delivery is on the way. Track it on the map.',
          read: false,
          actionable: true,
          delivery_id: jobId,
        });
        try {
          await supabase.functions.invoke('send-push', {
            body: {
              userIds: [customerUserId],
              title: 'Rider picked up your package',
              body: 'Your delivery is on the way. Track it on the map.',
              data: { type: 'delivery_update', deliveryId: jobId },
            },
          });
        } catch (_) {}
      }
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : 'Failed to confirm pickup.');
    } finally {
      setConfirming(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!jobId || !user) return;
    setConfirming(true);
    try {
      const { data, error } = await (supabase as any)
        .from('deliveries')
        .update({ status: 'delivered', completed_at: new Date().toISOString() })
        .eq('id', jobId)
        .eq('status', 'picked_up')
        .select('user_id');
      if (error) throw error;
      if (!data?.length) {
        showAlert('Error', 'Invalid state. Cannot confirm delivery.');
        setConfirming(false);
        return;
      }
      const customerUserId = data[0]?.user_id ?? null;
      if (customerUserId) {
        await (supabase as any).from('notifications').insert({
          user_id: customerUserId,
          rider_id: null,
          type: 'delivery_update',
          title: 'Delivery completed',
          message: 'Your package has been delivered. Thank you for using Ridely!',
          read: false,
          actionable: true,
          delivery_id: jobId,
        });
        try {
          await supabase.functions.invoke('send-push', {
            body: {
              userIds: [customerUserId],
              title: 'Delivery completed',
              body: 'Your package has been delivered. Thank you for using Ridely!',
              data: { type: 'delivery_update', deliveryId: jobId },
            },
          });
        } catch (_) {}
      }
      await (supabase as any).from('riders').update({ is_available: true }).eq('id', user.id);
      setDelivery((prev) => (prev ? { ...prev, status: 'delivered' } : null));
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : 'Failed to confirm delivery.');
    } finally {
      setConfirming(false);
    }
  };

  const pickupCoords = pickupCoordsState ?? { latitude: 6.5244, longitude: 3.3792 };
  const dropoffCoords = dropoffCoordsState ?? { latitude: 6.5244, longitude: 3.3892 };
  const riderCoordsForMap = riderCoords ?? pickupCoords;

  const mapRegion = useMemo(() => {
    const allMapPoints = [riderCoordsForMap, pickupCoords, dropoffCoords].filter(Boolean);
    if (allMapPoints.length >= 2) {
      const lats = allMapPoints.map((p) => p.latitude);
      const lngs = allMapPoints.map((p) => p.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const pad = 0.01;
      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(maxLat - minLat + pad, 0.02),
        longitudeDelta: Math.max(maxLng - minLng + pad, 0.02),
      };
    }
    return {
      latitude: riderCoordsForMap.latitude,
      longitude: riderCoordsForMap.longitude,
      ...DEFAULT_DELTA,
    };
  }, [riderCoordsForMap.latitude, riderCoordsForMap.longitude, pickupCoords.latitude, pickupCoords.longitude, dropoffCoords.latitude, dropoffCoords.longitude]);
  const speedKmhRounded = Math.max(0, Math.round(riderSpeedKmh));

  // Fit once to show rider, pickup, and dropoff together.
  useEffect(() => {
    if (!mapReady || !mapRef.current || didInitialFitRef.current) return;
    mapRef.current.fitToCoordinates?.([riderCoordsForMap, pickupCoords, dropoffCoords], {
      edgePadding: { top: 80, right: 50, bottom: 280, left: 50 },
      animated: false,
    });
    didInitialFitRef.current = true;
  }, [mapReady, riderCoordsForMap, pickupCoords, dropoffCoords]);

  // Smoothly follow rider after initial fit without controlling the full region.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !riderCoords || !followMode) return;
    mapRef.current.animateCamera?.(
      {
        center: {
          latitude: riderCoords.latitude,
          longitude: riderCoords.longitude,
        },
        zoom: getZoomForSpeed(riderSpeedKmh),
      },
      { duration: 500 }
    );
  }, [mapReady, followMode, riderCoords?.latitude, riderCoords?.longitude, riderSpeedKmh]);

  // Snap to route bounds whenever route gets refreshed while follow mode is on.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !followMode) return;
    const points = routeCoordinates.length > 1 ? routeCoordinates : [riderCoordsForMap, pickupCoords, dropoffCoords];
    if (points.length < 2) return;
    mapRef.current.fitToCoordinates?.(points, {
      edgePadding: { top: 80, right: 50, bottom: 280, left: 50 },
      animated: true,
    });
  }, [mapReady, followMode, routeCoordinates.length, pickupCoords.latitude, pickupCoords.longitude, dropoffCoords.latitude, dropoffCoords.longitude]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = (status: DeliveryStatus) => {
    switch (status) {
      case 'heading_to_pickup':
        return 'Heading to Pickup';
      case 'at_pickup':
        return 'At Pickup Location';
      case 'picked_up':
        return 'Package Picked Up';
      case 'heading_to_dropoff':
        return 'Heading to Dropoff';
      case 'at_dropoff':
        return 'At Dropoff Location';
      case 'delivered':
        return 'Delivered';
      default:
        return 'In Progress';
    }
  };

  const getNextAction = () => {
    const s = delivery?.status;
    if (s === 'accepted' || s === 'rider_assigned') {
      return { text: 'Confirm Pickup', action: handleConfirmPickup };
    }
    if (s === 'picked_up') {
      return { text: 'Confirm Delivery', action: handleConfirmDelivery };
    }
    switch (deliveryStatus) {
      case 'heading_to_pickup':
        return {
          text: 'Arrived at Pickup',
          action: () => setDeliveryStatus('at_pickup'),
        };
      case 'at_pickup':
        return {
          text: 'Mark as Picked Up',
          action: handleConfirmPickup,
        };
      case 'picked_up':
        return {
          text: 'Start Delivery',
          action: () => setDeliveryStatus('heading_to_dropoff'),
        };
      case 'heading_to_dropoff':
        return {
          text: 'Arrived at Dropoff',
          action: () => setDeliveryStatus('at_dropoff'),
        };
      case 'at_dropoff':
        return { text: 'Complete Delivery', action: handleConfirmDelivery };
      default:
        return null;
    }
  };

  const handleContactSender = () => {
    showAlert('Contact Sender', `Contact ${job?.senderName}`, [
      {
        text: 'Call',
        onPress: () => showAlert('Calling', `Calling ${job?.senderName}...`),
      },
      {
        text: 'Message',
        onPress: () => showAlert('Message', 'Opening chat...'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleContactReceiver = () => {
    showAlert('Contact Receiver', 'Contact the package receiver', [
      {
        text: 'Call',
        onPress: () => showAlert('Calling', 'Calling receiver...'),
      },
      {
        text: 'Message',
        onPress: () => showAlert('Message', 'Opening chat...'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (!job) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            Job data not found
          </Text>
          <AnimatedPressable
            style={[
              styles.backButton,
              { backgroundColor: theme.colors.primary },
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  const nextAction = getNextAction();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Header - extends under status bar */}
      <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
        <AnimatedPressable
          style={styles.headerBackButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Active Delivery
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Google Map (react-native-maps) - always visible */}
      <View
        style={[styles.mapContainer, { backgroundColor: theme.colors.surface }]}
      >
        {RNMaps ? (
          <RNMaps.default
            ref={mapRef}
            style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}
            mapType="standard"
            initialRegion={mapRegion}
            onMapReady={() => setMapReady(true)}
            loadingEnabled
            moveOnMarkerPress={false}
            toolbarEnabled={false}
            onPanDrag={() => setFollowMode(false)}
            onTouchStart={() => {
              if (followMode) setFollowMode(false);
            }}
          >
            {routeCoordinates.length > 0 && RNMaps.Polyline && (
              <RNMaps.Polyline
                coordinates={routeCoordinates}
                strokeColor={theme.colors.primary ?? '#5A47FF'}
                strokeWidth={4}
                lineCap="round"
                lineJoin="round"
              />
            )}
            {pickupCoordsState && (
              <RNMaps.Marker
                coordinate={pickupCoords}
                title="Pickup"
                description={job?.pickupAddress}
                pinColor={Platform.OS === 'android' ? '#10B981' : undefined}
                tracksViewChanges={false}
              />
            )}
            {dropoffCoordsState && (
              <RNMaps.Marker
                coordinate={dropoffCoords}
                title="Dropoff"
                description={job?.dropoffAddress}
                pinColor={Platform.OS === 'android' ? '#EF4444' : undefined}
                tracksViewChanges={false}
              />
            )}
            {riderCoords && (
              <RNMaps.Marker
                coordinate={{ latitude: riderCoords.latitude, longitude: riderCoords.longitude }}
                title="Your location"
                pinColor={Platform.OS === 'android' ? (theme.colors.primary ?? '#5A47FF') : undefined}
                tracksViewChanges={false}
              />
            )}
          </RNMaps.default>
        ) : (
          <View style={[styles.mapPlaceholder, { backgroundColor: theme.colors.surface }]}>
            <MapPin size={48} color={theme.colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.mapText, { color: theme.colors.text }]}>
              Map unavailable in Expo Go
            </Text>
            <Text style={[styles.mapSubtext, { color: theme.colors.textSecondary }]}>
              Run a development build (expo run:android / expo run:ios) for maps.
            </Text>
          </View>
        )}
        {/* Status Overlay */}
        <View
          style={[
            styles.statusOverlay,
            { backgroundColor: theme.colors.surface },
            theme.shadows.large,
          ]}
        >
          <View style={styles.statusHeader}>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusText, { color: theme.colors.text }]}>
                {getStatusText(deliveryStatus)}
              </Text>
              <Text
                style={[styles.elapsedTime, { color: theme.colors.primary }]}
              >
                {formatTime(elapsedTime)}
              </Text>
            </View>
            <View
              style={[
                styles.rewardBadge,
                { backgroundColor: theme.colors.success },
              ]}
            >
              <Text style={styles.rewardText}>₦{job.reward}</Text>
            </View>
          </View>
        </View>
        <AnimatedPressable
          style={[
            styles.followToggle,
            { backgroundColor: followMode ? theme.colors.primary : theme.colors.surface },
            theme.shadows.medium,
          ]}
          onPress={() => {
            const next = !followMode;
            setFollowMode(next);
            if (next && riderCoords) {
              mapRef.current?.animateCamera?.(
                {
                  center: {
                    latitude: riderCoords.latitude,
                    longitude: riderCoords.longitude,
                  },
                  zoom: getZoomForSpeed(riderSpeedKmh),
                },
                { duration: 450 }
              );
            }
          }}
        >
          <Text style={{ color: followMode ? '#FFFFFF' : theme.colors.text, fontWeight: '600' }}>
            Follow
          </Text>
        </AnimatedPressable>
        <View
          style={[
            styles.followStateChip,
            {
              backgroundColor: followMode ? `${theme.colors.primary}E6` : theme.colors.surface,
            },
            theme.shadows.small,
          ]}
        >
          <Text style={{ color: followMode ? '#FFFFFF' : theme.colors.text, fontSize: 11, fontWeight: '700' }}>
            {followMode ? 'FOLLOWING' : 'FREE PAN'}
          </Text>
          <Text style={{ color: followMode ? 'rgba(255,255,255,0.92)' : theme.colors.textSecondary, fontSize: 11, marginTop: 2 }}>
            {speedKmhRounded} km/h
          </Text>
        </View>
      </View>

      {/* Job Details */}
      <View
        style={[
          styles.jobDetails,
          { backgroundColor: theme.colors.surface },
          theme.shadows.medium,
        ]}
      >
        <View style={styles.jobHeader}>
          <Text style={[styles.jobId, { color: theme.colors.text }]}>
            #{job.id}
          </Text>
          <View style={styles.sizeIndicator}>
            <Package size={16} color={theme.colors.primary} strokeWidth={2} />
            <Text style={[styles.sizeText, { color: theme.colors.primary }]}>
              {job.parcelSize.charAt(0).toUpperCase() + job.parcelSize.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.addressContainer}>
          <View style={styles.addressRow}>
            <MapPin size={20} color={theme.colors.success} strokeWidth={2} />
            <View style={styles.addressInfo}>
              <Text
                style={[
                  styles.addressLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Pickup
              </Text>
              <Text style={[styles.addressText, { color: theme.colors.text }]}>
                {job.pickupAddress}
              </Text>
            </View>
          </View>

          <View style={styles.addressDivider} />

          <View style={styles.addressRow}>
            <MapPin size={20} color={theme.colors.error} strokeWidth={2} />
            <View style={styles.addressInfo}>
              <Text
                style={[
                  styles.addressLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Dropoff
              </Text>
              <Text style={[styles.addressText, { color: theme.colors.text }]}>
                {job.dropoffAddress}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.metaInfo}>
          <View style={styles.metaItem}>
            <Navigation
              size={16}
              color={theme.colors.textSecondary}
              strokeWidth={2}
            />
            <Text
              style={[styles.metaText, { color: theme.colors.textSecondary }]}
            >
              {job.distance} km
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Clock
              size={16}
              color={theme.colors.textSecondary}
              strokeWidth={2}
            />
            <Text
              style={[styles.metaText, { color: theme.colors.textSecondary }]}
            >
              ~{job.estimatedTime}
            </Text>
          </View>
        </View>
      </View>

      {/* Contact Options */}
      <View style={styles.contactContainer}>
        <AnimatedPressable
          style={[
            styles.contactButton,
            { backgroundColor: theme.colors.surface },
            theme.shadows.medium,
          ]}
          onPress={handleContactSender}
        >
          <User size={20} color={theme.colors.primary} strokeWidth={2} />
          <Text style={[styles.contactText, { color: theme.colors.text }]}>
            Contact Sender
          </Text>
        </AnimatedPressable>

        <AnimatedPressable
          style={[
            styles.contactButton,
            { backgroundColor: theme.colors.surface },
            theme.shadows.medium,
          ]}
          onPress={handleContactReceiver}
        >
          <Package size={20} color={theme.colors.success} strokeWidth={2} />
          <Text style={[styles.contactText, { color: theme.colors.text }]}>
            Contact Receiver
          </Text>
        </AnimatedPressable>
      </View>

      {/* Action Button */}
      {nextAction && deliveryStatus !== 'delivered' && (
        <View style={styles.actionContainer}>
          <AnimatedPressable
            style={[
              styles.actionButton,
              { backgroundColor: theme.colors.primary },
            ]}
            onPress={nextAction.action}
            disabled={confirming}
          >
            <CheckCircle size={20} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.actionText}>{confirming ? 'Updating…' : nextAction.text}</Text>
          </AnimatedPressable>
        </View>
      )}

      {deliveryStatus === 'delivered' && (
        <View style={styles.completedContainer}>
          <View
            style={[
              styles.completedCard,
              { backgroundColor: theme.colors.success },
            ]}
          >
            <CheckCircle size={32} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.completedText}>Delivery Completed!</Text>
            <Text style={styles.completedSubtext}>
              You earned ₦{(job.reward * 0.85).toFixed(2)} (net)
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  mapContainer: {
    height: 280,
    position: 'relative',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  mapText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  mapSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  statusOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    borderRadius: 12,
    padding: 16,
  },
  followToggle: {
    position: 'absolute',
    right: 20,
    top: 98,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  followStateChip: {
    position: 'absolute',
    right: 20,
    top: 148,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  elapsedTime: {
    fontSize: 14,
    fontWeight: '600',
  },
  rewardBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  rewardText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  jobDetails: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  jobId: {
    fontSize: 18,
    fontWeight: '700',
  },
  sizeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  sizeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  addressContainer: {
    marginBottom: 20,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  addressInfo: {
    marginLeft: 12,
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  addressDivider: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginLeft: 10,
    marginBottom: 12,
  },
  metaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 14,
    marginLeft: 6,
  },
  contactContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionContainer: {
    padding: 20,
  },
  actionButton: {
    flexDirection: 'row',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  completedContainer: {
    padding: 20,
  },
  completedCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  completedText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 8,
  },
  completedSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

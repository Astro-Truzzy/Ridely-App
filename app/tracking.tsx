import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
  PanResponder,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  MessageCircle,
  Phone,
  Package,
  User,
  Star,
  Shield,
  MapPin,
  CreditCard,
  Bike,
  Crosshair,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { useDeliveries, type Delivery } from '@/hooks/useDeliveries';
import { useAutoCancelPendingDelivery } from '@/hooks/useAutoCancelPendingDelivery';
import { fetchGoogleDirections, geocodeAddress } from '@/lib/googleDirections';

interface RiderInfo {
  name: string;
  rating: number;
  phone: string;
  vehicle: string;
  plateNumber: string;
  estimatedArrival: string;
  currentLocation: string;
}

type DisplayStatus =
  | 'pending'
  | 'rider_assigned'
  | 'picked_up'
  | 'in_transit'
  | 'nearby'
  | 'delivered'
  | 'completed'
  | 'cancelled';

const DELIVERY_PROGRESS_STEPS: { status: DisplayStatus; text: string }[] = [
  { status: 'pending', text: 'Searching for a rider' },
  { status: 'rider_assigned', text: 'Rider assigned to your delivery' },
  { status: 'picked_up', text: 'Package picked up' },
  { status: 'in_transit', text: 'Package in transit' },
  { status: 'nearby', text: 'Rider approaching destination' },
  { status: 'delivered', text: 'Package delivered' },
  { status: 'completed', text: 'Delivery completed' },
];

const PROGRESS_INDEX: Record<DisplayStatus, number> = {
  pending: 0,
  rider_assigned: 1,
  picked_up: 2,
  in_transit: 3,
  nearby: 4,
  delivered: 5,
  completed: 6,
  cancelled: -1,
};

function mapDeliveryToDisplayStatus(status: Delivery['status'] | undefined): DisplayStatus {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'rider_assigned':
    case 'accepted':
      return 'rider_assigned';
    case 'picked_up':
      return 'picked_up';
    case 'in_transit':
      return 'in_transit';
    case 'nearby':
      return 'nearby';
    case 'delivered':
      return 'delivered';
    case 'completed':
      return 'completed';
    case 'cancelled':
    case 'cancelled_no_rider':
      return 'cancelled';
    default:
      return 'pending';
  }
}

/** Maps DB status to the active step index in DELIVERY_PROGRESS_STEPS. */
function getProgressIndex(status: Delivery['status'] | undefined): number {
  const display = mapDeliveryToDisplayStatus(status);
  if (display === 'cancelled') return -1;
  // Rider app keeps status at picked_up while en route — show in-transit as current.
  if (display === 'picked_up') return PROGRESS_INDEX.in_transit;
  return PROGRESS_INDEX[display];
}

const ANDROID_MARKER_IMAGES = {
  rider: require('@/assets/markers/marker-rider.png'),
  pickup: require('@/assets/markers/marker-pickup.png'),
  dropoff: require('@/assets/markers/marker-dropoff.png'),
};

// Simplified map style: light background, soft roads/labels (lower contrast for readability).
const SIMPLIFIED_MAP_STYLE = [
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e8eaed' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f8f8f8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d8d8d8' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#ebebeb' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#c8e6c9' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#a8a8a8' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'simplified' }, { saturation: 0 }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#a8a8a8' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ visibility: 'on' }] },
  { featureType: 'transit.station', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#a8a8a8' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#fafafa' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#a8a8a8' }] },
];

const ROUTE_LINE_COLOR = '#22C55E';
const DEFAULT_DELTA = { latitudeDelta: 0.05, longitudeDelta: 0.05 };

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getZoomForSpeed(speedKmh: number): number {
  if (speedKmh < 10) return 16.8;
  if (speedKmh < 25) return 15.8;
  if (speedKmh < 45) return 14.8;
  return 13.8;
}

export default function TrackingScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { deliveries, updateDeliveryStatus } = useDeliveries();
  const params = useLocalSearchParams<{ deliveryId?: string }>();
  
  // Get active delivery - from params or most recent non-completed (including pending "searching for rider")
  const activeDeliveryFromList = params.deliveryId
    ? deliveries.find(d => d.id === params.deliveryId)
    : deliveries.find(d =>
        d.status !== 'delivered' &&
        d.status !== 'cancelled' &&
        d.status !== 'cancelled_no_rider' &&
        d.status !== 'completed'
      );

  const [localDelivery, setLocalDelivery] = useState<typeof activeDeliveryFromList>(activeDeliveryFromList);
  const activeDelivery = localDelivery ?? activeDeliveryFromList;
  const riderId = activeDelivery?.rider_id || null;
  const isSearchingForRider = activeDelivery && !riderId;

  // Trigger auto-cancel after 2 min when user is on tracking and still "searching for rider"
  useAutoCancelPendingDelivery(
    activeDelivery?.status === 'pending' && !activeDelivery?.rider_id ? activeDelivery : null
  );

  useEffect(() => {
    setLocalDelivery((prev) => activeDeliveryFromList ?? prev);
  }, [activeDeliveryFromList?.id, activeDeliveryFromList?.updated_at]);

  const deliveryId = activeDelivery?.id;
  useEffect(() => {
    if (!deliveryId) return;
    const channel = supabase
      .channel(`delivery-${deliveryId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: `id=eq.${deliveryId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          setLocalDelivery((prev) => (prev ? { ...prev, ...payload.new } : (payload.new as unknown) as Delivery));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [deliveryId]);

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
        if (mounted) setRNMaps({ default: maps.default as unknown as React.ComponentType<any>, Marker: maps.Marker as unknown as React.ComponentType<any>, Polyline: maps.Polyline as unknown as React.ComponentType<any> });
      })
      .catch(() => {
        if (mounted) setRNMaps(null);
      });
    return () => { mounted = false; };
  }, []);

  const displayStatus = useMemo(
    () => mapDeliveryToDisplayStatus(activeDelivery?.status),
    [activeDelivery?.status]
  );
  const progressIndex = useMemo(
    () => getProgressIndex(activeDelivery?.status),
    [activeDelivery?.status]
  );

  const [rider, setRider] = useState<RiderInfo>({
    name: 'Loading...',
    rating: 0,
    phone: '',
    vehicle: '',
    plateNumber: '',
    estimatedArrival: 'Calculating...',
    currentLocation: '',
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [mapExpanded, setMapExpanded] = useState(false);
  // Real-time rider coordinates (live updates from rider app)
  const [riderCoords, setRiderCoords] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
  });
  const [isLive, setIsLive] = useState(false);
  const subscriptionRef = useRef<any | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [followMode, setFollowMode] = useState(true);
  const [riderSpeedKmh, setRiderSpeedKmh] = useState(0);
  const lastRiderSampleRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  
  // Draggable card state – top of map
  const [cardPosition, setCardPosition] = useState({ x: 16, y: 16 });
  const initialPosition = useRef({ x: 16, y: 16 });
  
  const mapRef = useRef<any>(null);

  const handleRecenterMap = () => {
    setFollowMode(true);
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
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gestureState) => {
        // Store the initial position
        initialPosition.current = { ...cardPosition };
      },
      onPanResponderMove: (_, gestureState) => {
        // Calculate new position based on initial position and gesture movement
        const newX = initialPosition.current.x + gestureState.dx;
        const newY = initialPosition.current.y + gestureState.dy;
        
        // Update position
        setCardPosition({
          x: newX,
          y: newY,
        });
      },
      onPanResponderRelease: () => {
        // Keep the card at the new position
      },
      onPanResponderTerminate: () => {
        // Keep the card at the new position
      },
    })
  ).current;

  const mapRegion = useMemo(() => {
    const points = [riderCoords, pickupCoords, dropoffCoords].filter(
      (p): p is { latitude: number; longitude: number } => !!p
    );
    if (points.length >= 2) {
      const lats = points.map((p) => p.latitude);
      const lngs = points.map((p) => p.longitude);
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
      latitude: riderCoords.latitude,
      longitude: riderCoords.longitude,
      ...DEFAULT_DELTA,
    };
  }, [riderCoords.latitude, riderCoords.longitude, pickupCoords?.latitude, pickupCoords?.longitude, dropoffCoords?.latitude, dropoffCoords?.longitude]);
  const speedKmhRounded = Math.max(0, Math.round(riderSpeedKmh));

  useEffect(() => {
    if (!mapExpanded || !mapRef.current) return;
    const fitPoints =
      routeCoordinates.length > 1
        ? routeCoordinates
        : [riderCoords, pickupCoords, dropoffCoords].filter(
            (p): p is { latitude: number; longitude: number } => !!p
          );
    if (fitPoints.length < 2) return;
    mapRef.current.fitToCoordinates?.(fitPoints, {
      edgePadding: { top: 90, right: 60, bottom: 320, left: 60 },
      animated: true,
    });
  }, [mapExpanded, routeCoordinates.length, pickupCoords?.latitude, pickupCoords?.longitude, dropoffCoords?.latitude, dropoffCoords?.longitude]);

  useEffect(() => {
    if (!mapExpanded || !followMode || !mapRef.current) return;
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
  }, [mapExpanded, followMode, riderCoords.latitude, riderCoords.longitude, riderSpeedKmh]);

  // Fetch rider info when delivery is available
  useEffect(() => {
    if (!riderId || !activeDelivery) return;

    const fetchRiderInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('riders')
          .select('full_name, rating, phone, vehicle_type, plate_number')
          .eq('id', riderId)
          .single();

        if (error) throw error;

        const row = data as { full_name?: string; rating?: number; phone?: string; vehicle_type?: string | null; plate_number?: string | null } | null;
        if (row) {
          setRider({
            name: row.full_name || 'Rider',
            rating: row.rating ?? 5.0,
            phone: row.phone || '',
            vehicle: row.vehicle_type || 'Motorcycle',
            plateNumber: row.plate_number || '',
            estimatedArrival: 'Calculating...',
            currentLocation: 'Updating...',
          });
        }
      } catch (error) {
        console.error('[tracking] Error fetching rider info:', error);
      }
    };

    fetchRiderInfo();
  }, [riderId, activeDelivery]);

  // Subscribe to Supabase Realtime for rider location (INSERT + UPDATE), debounced
  useEffect(() => {
    if (!riderId) {
      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const DEBOUNCE_MS = 500;

    const handleLocationPayload = (payload: { new?: { latitude: number; longitude: number } }) => {
      if (!payload.new) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const next = payload.new!;
        const now = Date.now();
        const prev = lastRiderSampleRef.current;
        if (prev) {
          const meters = haversineMeters(prev.lat, prev.lng, next.latitude, next.longitude);
          const seconds = Math.max((now - prev.ts) / 1000, 1);
          const kmh = (meters / seconds) * 3.6;
          setRiderSpeedKmh((old) => old * 0.7 + Math.min(kmh, 120) * 0.3);
        }
        lastRiderSampleRef.current = { lat: next.latitude, lng: next.longitude, ts: now };
        setRiderCoords({
          latitude: next.latitude,
          longitude: next.longitude,
        });
        setIsLive(true);
        debounceTimer = null;
      }, DEBOUNCE_MS);
    };

    // Supabase RealtimeChannel types only expose 'system' in .on(); postgres_changes is supported at runtime
    type ChannelWithPostgres = Parameters<typeof supabase.removeChannel>[0] & {
      on(ev: string, cfg: object, cb: (p: { new?: { latitude: number; longitude: number } }) => void): ChannelWithPostgres;
    };
    const channel = (supabase.channel(`rider-location:${riderId}`) as ChannelWithPostgres)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rider_locations',
          filter: `rider_id=eq.${riderId}`,
        },
        handleLocationPayload
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rider_locations',
          filter: `rider_id=eq.${riderId}`,
        },
        handleLocationPayload
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsLive(true);
      });

    subscriptionRef.current = channel;

    // Fetch initial location once
    (async () => {
      try {
        const { data, error } = await supabase
          .from('rider_locations')
          .select('latitude,longitude')
          .eq('rider_id', riderId)
          .maybeSingle();

        if (!error && data) {
          const location = data as { latitude: number; longitude: number };
          setRiderCoords({
            latitude: location.latitude,
            longitude: location.longitude,
          });
        }
      } catch (err) {
        console.warn('[tracking] initial location fetch error', err);
      }
    })();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      setIsLive(false);
      try {
        if (subscriptionRef.current) {
          supabase.removeChannel(subscriptionRef.current).catch(() => {});
          subscriptionRef.current = null;
        }
      } catch (e) {
        console.warn('[tracking] subscription cleanup failed', e);
      }
    };
  }, [riderId]);

  // Geocode pickup and dropoff addresses so we can draw route and markers
  useEffect(() => {
    if (!activeDelivery?.pickup_address || !activeDelivery?.dropoff_address) return;
    let cancelled = false;
    (async () => {
      const [pickup, dropoff] = await Promise.all([
        geocodeAddress(activeDelivery.pickup_address),
        geocodeAddress(activeDelivery.dropoff_address),
      ]);
      if (cancelled) return;
      if (pickup) setPickupCoords(pickup);
      if (dropoff) setDropoffCoords(dropoff);
    })();
    return () => { cancelled = true; };
  }, [activeDelivery?.pickup_address, activeDelivery?.dropoff_address]);

  // Fetch route from rider to dropoff and update ETA (debounced when rider moves)
  const riderCoordsRef = useRef(riderCoords);
  const dropoffCoordsRef = useRef(dropoffCoords);
  riderCoordsRef.current = riderCoords;
  dropoffCoordsRef.current = dropoffCoords;
  const routeFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRouteFetchRef = useRef(0);
  const ROUTE_DEBOUNCE_MS = 12000;

  useEffect(() => {
    const drop = dropoffCoordsRef.current;
    if (!drop) return;

    const fetchRouteAndEta = async () => {
      const rider = riderCoordsRef.current;
      const result = await fetchGoogleDirections(
        rider.latitude,
        rider.longitude,
        drop.latitude,
        drop.longitude
      );
      if (!result) return;
      setRouteCoordinates(result.coordinates);
      const mins = Math.round(result.durationSeconds / 60);
      const etaText = mins < 1 ? '< 1 min' : mins === 1 ? '1 min' : `${mins} mins`;
      setRider((prev) => ({ ...prev, estimatedArrival: etaText }));
    };

    const now = Date.now();
    const timeSinceLastFetch = now - lastRouteFetchRef.current;
    const isFirstFetch = timeSinceLastFetch > ROUTE_DEBOUNCE_MS || lastRouteFetchRef.current === 0;

    if (isFirstFetch) {
      lastRouteFetchRef.current = now;
      fetchRouteAndEta();
      return () => {
        if (routeFetchRef.current) clearTimeout(routeFetchRef.current);
      };
    }

    if (routeFetchRef.current) clearTimeout(routeFetchRef.current);
    routeFetchRef.current = setTimeout(() => {
      routeFetchRef.current = null;
      lastRouteFetchRef.current = Date.now();
      fetchRouteAndEta();
    }, Math.max(0, ROUTE_DEBOUNCE_MS - timeSinceLastFetch));

    return () => {
      if (routeFetchRef.current) clearTimeout(routeFetchRef.current);
    };
  }, [dropoffCoords?.latitude, dropoffCoords?.longitude, riderCoords.latitude, riderCoords.longitude]);

  useEffect(() => {
    if (!activeDelivery?.created_at) {
      setElapsedTime(0);
      return;
    }
    const startMs = new Date(activeDelivery.created_at).getTime();
    const tick = () => {
      setElapsedTime(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [activeDelivery?.created_at]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = (status: DisplayStatus) => {
    switch (status) {
      case 'pending':
        return 'Searching for Rider';
      case 'rider_assigned':
        return 'Rider Assigned';
      case 'picked_up':
        return 'Package Picked Up';
      case 'in_transit':
        return 'In Transit';
      case 'nearby':
        return 'Rider Nearby';
      case 'delivered':
        return 'Delivered';
      case 'completed':
        return 'Delivery Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Processing';
    }
  };

  const getStatusColor = (status: DisplayStatus) => {
    switch (status) {
      case 'pending':
        return theme.colors.textTertiary;
      case 'rider_assigned':
        return theme.colors.accent;
      case 'picked_up':
        return '#8B5CF6';
      case 'in_transit':
        return theme.colors.primary;
      case 'nearby':
        return theme.colors.warning;
      case 'delivered':
        return theme.colors.success;
      case 'completed':
        return theme.colors.success;
      case 'cancelled':
        return theme.colors.error;
      default:
        return theme.colors.textTertiary;
    }
  };

  const handleCall = () => {
    showAlert('Call Rider', 'Choose how you want to call Mike', [
      {
        text: 'In-App Call',
        onPress: () =>
          showAlert('In-App Call', 'Starting in-app call with Mike...'),
      },
      {
        text: 'Phone Call',
        onPress: () => showAlert('Phone Call', `Calling ${rider.phone}...`),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleMessage = () => {
    router.push('/chat');
  };

  const handleMarkDelivered = () => {
    if (!activeDelivery?.id) return;
    showAlert('Confirm Delivery', 'Has your package been delivered?', [
      { text: 'No, Not Yet', style: 'cancel' },
      {
        text: 'Yes, Delivered',
        onPress: async () => {
          try {
            await updateDeliveryStatus(activeDelivery.id, 'delivered');
            showAlert(
              'Delivery Confirmed',
              'Thank you! Your delivery has been marked as completed.'
            );
          } catch (e) {
            showAlert(
              'Error',
              e instanceof Error ? e.message : 'Could not confirm delivery. Please try again.'
            );
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style="light" />
      {/* Header - extends under status bar; content padded by insets.top */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.primary,
            paddingTop: 16 + insets.top,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>Track Delivery</Text>
          {riderId && (
            <View style={[styles.liveBadge, isLive && styles.liveBadgeActive]}>
              <View style={[styles.liveDot, isLive && styles.liveDotActive]} />
              <Text style={styles.liveText}>{isLive ? 'Live' : 'Connecting…'}</Text>
            </View>
          )}
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Map Area with Preview and Tap-to-Expand */}
        <TouchableOpacity
          style={[styles.mapContainer, { backgroundColor: isDark ? theme.colors.card : '#E5E7EB' }]}
          activeOpacity={0.8}
          onPress={() => setMapExpanded(true)}
        >
          {RNMaps ? (
            <RNMaps.default
              style={styles.map}
              mapType="standard"
              customMapStyle={SIMPLIFIED_MAP_STYLE}
              initialRegion={mapRegion}
              loadingEnabled
              moveOnMarkerPress={false}
              toolbarEnabled={false}
              liteMode={Platform.OS === 'android'}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
            >
              {routeCoordinates.length > 0 && (
                <RNMaps.Polyline
                  coordinates={routeCoordinates}
                  strokeColor={ROUTE_LINE_COLOR}
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                />
              )}
              {pickupCoords && (
                Platform.OS === 'ios' ? (
                  <RNMaps.Marker coordinate={pickupCoords} title="Pickup Location" anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                    <View style={styles.customMarker}>
                      <View style={[styles.markerIconWrap, { backgroundColor: '#10B981' }]}>
                        <Package size={16} color="#FFFFFF" strokeWidth={2.5} />
                      </View>
                    </View>
                  </RNMaps.Marker>
                ) : (
                  <RNMaps.Marker coordinate={pickupCoords} title="Pickup Location" anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                    <View style={styles.customMarker}>
                      <Image source={ANDROID_MARKER_IMAGES.pickup} style={styles.markerImage} resizeMode="contain" />
                    </View>
                  </RNMaps.Marker>
                )
              )}
              {dropoffCoords && (
                Platform.OS === 'ios' ? (
                  <RNMaps.Marker coordinate={dropoffCoords} title="Dropoff Location" anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                    <View style={styles.customMarker}>
                      <View style={[styles.markerIconWrap, { backgroundColor: '#EF4444' }]}>
                        <MapPin size={16} color="#FFFFFF" strokeWidth={2.5} />
                      </View>
                    </View>
                  </RNMaps.Marker>
                ) : (
                  <RNMaps.Marker coordinate={dropoffCoords} title="Dropoff Location" anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                    <View style={styles.customMarker}>
                      <Image source={ANDROID_MARKER_IMAGES.dropoff} style={styles.markerImage} resizeMode="contain" />
                    </View>
                  </RNMaps.Marker>
                )
              )}
              {Platform.OS === 'ios' ? (
                <RNMaps.Marker
                  coordinate={{ latitude: riderCoords.latitude, longitude: riderCoords.longitude }}
                  title="Rider Location"
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <View style={styles.customMarker}>
                    <View style={[styles.markerIconWrap, { backgroundColor: theme.colors.primary || ROUTE_LINE_COLOR }]}>
                      <Bike size={16} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                  </View>
                </RNMaps.Marker>
              ) : (
                <RNMaps.Marker
                  coordinate={{ latitude: riderCoords.latitude, longitude: riderCoords.longitude }}
                  title="Rider Location"
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <View style={styles.customMarker}>
                    <Image source={ANDROID_MARKER_IMAGES.rider} style={styles.markerImage} resizeMode="contain" />
                  </View>
                </RNMaps.Marker>
              )}
            </RNMaps.default>
          ) : (
            <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.surface }]}>
              <Text style={{ color: theme.colors.textSecondary }}>Map requires a development build</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Draggable Status Card - Moved outside map container */}
        {!mapExpanded && (
          <TouchableOpacity 
            style={[
              styles.statusCard,
              {
                position: 'absolute',
                left: cardPosition.x,
                top: cardPosition.y,
                zIndex: 100,
                width: 200,
                backgroundColor: theme.colors.card,
                shadowColor: isDark ? '#000' : '#000',
                ...theme.shadows.large,
              }
            ]}
            {...panResponder.panHandlers}
            activeOpacity={1}
          >
            <View style={styles.statusHeader}>
              <View style={styles.statusIndicator}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: getStatusColor(displayStatus) },
                  ]}
                />
                <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>
                  {isSearchingForRider ? 'Searching for rider…' : getStatusText(displayStatus)}
                </Text>
              </View>
              <Text style={[styles.elapsedTime, { color: theme.colors.primary }]}>{formatTime(elapsedTime)}</Text>
            </View>
            <Text style={[styles.estimatedArrival, { color: theme.colors.textTertiary }]}>
              Estimated arrival: {isSearchingForRider ? '—' : rider.estimatedArrival}
            </Text>
          </TouchableOpacity>
        )}

        {/* Rider Info Card - hidden when map is fullscreen */}
        {!mapExpanded && (
        <View style={[styles.riderCard, {
          backgroundColor: theme.colors.card,
          ...theme.shadows.medium,
        }]}>
          <View style={styles.riderHeader}>
            <View style={[styles.riderAvatar, { backgroundColor: theme.colors.primary }]}>
              <User size={24} color="#FFFFFF" strokeWidth={2} />
            </View>
            <View style={styles.riderInfo}>
              <Text style={[styles.riderName, { color: theme.colors.text }]}>
                {isSearchingForRider ? 'Searching for rider…' : rider.name}
              </Text>
              {!isSearchingForRider && (
                <View style={styles.riderRating}>
                  <Star size={16} color="#FFC947" fill="#FFC947" strokeWidth={2} />
                  <Text style={[styles.ratingText, { color: theme.colors.textSecondary }]}>{rider.rating}</Text>
                </View>
              )}
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.messageButton, { backgroundColor: isDark ? theme.colors.surface : '#F0F2FF' }]}
                onPress={handleMessage}
                disabled={isSearchingForRider}
              >
                <MessageCircle size={20} color={theme.colors.primary} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.callButton, { backgroundColor: theme.colors.success }]}
                onPress={handleCall}
                disabled={isSearchingForRider}
              >
                <Phone size={20} color="#FFFFFF" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.riderDetails}>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.colors.textTertiary }]}>{'Vehicle:'}</Text>
              <Text style={[styles.detailValue, { color: theme.colors.textSecondary }]}>{rider.vehicle}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.colors.textTertiary }]}>{'Plate:'}</Text>
              <Text style={[styles.detailValue, { color: theme.colors.textSecondary }]}>{rider.plateNumber}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.colors.textTertiary }]}>{'Location:'}</Text>
              <Text style={[styles.detailValue, { color: theme.colors.textSecondary }]}>{rider.currentLocation}</Text>
            </View>
          </View>
        </View>
        )}

        {/* Quick action buttons + info cards - hidden when map fullscreen */}
        {!mapExpanded && (
        <View style={styles.quickActionsSection}>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: isDark ? theme.colors.surface : '#F0F2FF' }]}
              onPress={() => {}}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: theme.colors.primary }]}>
                <User size={22} color="#FFFFFF" strokeWidth={2} />
                <View style={styles.verifiedBadge}>
                  <Star size={10} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2} />
                </View>
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {isSearchingForRider ? '…' : rider.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: isDark ? theme.colors.surface : '#F0F2FF' }]}
              onPress={handleMessage}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: theme.colors.primary }]}>
                <MessageCircle size={22} color="#FFFFFF" strokeWidth={2} />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.textSecondary }]}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: isDark ? theme.colors.surface : '#F0F2FF' }]}
              onPress={handleCall}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: theme.colors.success }]}>
                <Phone size={22} color="#FFFFFF" strokeWidth={2} />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.textSecondary }]}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: isDark ? theme.colors.surface : '#F0F2FF' }]}
              onPress={() => router.push('/support')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: isDark ? theme.colors.border : '#6B7280' }]}>
                <Shield size={22} color="#FFFFFF" strokeWidth={2} />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.textSecondary }]}>Safety</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.infoCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => {}}
            activeOpacity={0.8}
          >
            <MapPin size={20} color={theme.colors.primary} strokeWidth={2} />
            <View style={styles.infoCardContent}>
              <Text style={[styles.infoCardTitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {activeDelivery?.dropoff_address || 'Dropoff address'}
              </Text>
              <Text style={[styles.infoCardSubtitle, { color: theme.colors.textTertiary }]}>Delivery destination</Text>
            </View>
            <ArrowLeft size={18} color={theme.colors.textTertiary} strokeWidth={2} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>

          <View style={[styles.infoCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <CreditCard size={20} color={theme.colors.primary} strokeWidth={2} />
            <View style={styles.infoCardContent}>
              <Text style={[styles.infoCardTitle, { color: theme.colors.textSecondary }]}>
                ₦{activeDelivery?.total_cost != null ? Number(activeDelivery.total_cost).toLocaleString('en-NG') : '—'}
              </Text>
              <Text style={[styles.infoCardSubtitle, { color: theme.colors.textTertiary }]}>Delivery fee</Text>
            </View>
          </View>
        </View>
        )}

        {/* Delivery Steps - hidden when map is fullscreen */}
        {!mapExpanded && (
        <View style={[styles.stepsContainer, { 
          backgroundColor: theme.colors.card,
          ...theme.shadows.medium,
        }]}>
          <Text style={[styles.stepsTitle, { color: theme.colors.textSecondary }]}>{'Delivery Progress'}</Text>

          {displayStatus === 'cancelled' ? (
            <Text style={[styles.stepText, { color: theme.colors.error }]}>
              This delivery was cancelled.
            </Text>
          ) : (
            DELIVERY_PROGRESS_STEPS.map((step, index) => {
              const isCompleted = progressIndex > index;
              const isCurrent = progressIndex === index;

              return (
                <View key={step.status} style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepIndicator,
                      isCompleted && [styles.completedStep, { backgroundColor: theme.colors.success }],
                      isCurrent && [styles.currentStep, { backgroundColor: theme.colors.primary }],
                      !isCompleted && !isCurrent && { backgroundColor: isDark ? theme.colors.border : '#E5E7EB' },
                    ]}
                  >
                    {isCompleted ? (
                      <Text style={styles.stepCheckmark}>✓</Text>
                    ) : (
                      <Text style={[styles.stepNumber, { color: isDark ? theme.colors.textSecondary : '#9CA3AF' }]}>
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepText,
                      { color: theme.colors.textSecondary },
                      isCompleted && { color: theme.colors.text },
                      isCurrent && { color: theme.colors.text, fontWeight: '600' },
                    ]}
                  >
                    {step.text}
                  </Text>
                </View>
              );
            })
          )}
        </View>
        )}

        {/* Bottom Action - hidden when map is fullscreen */}
        {!mapExpanded && displayStatus === 'nearby' && (
          <View style={[styles.bottomContainer, { 
            backgroundColor: theme.colors.card,
            borderTopColor: theme.colors.border
          }]}>
            <TouchableOpacity
              style={[styles.deliveredButton, { backgroundColor: theme.colors.success }]}
              onPress={handleMarkDelivered}
            >
              <Package size={20} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.deliveredText}>Mark as Delivered</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Fullscreen Map - outside ScrollView so it covers entire screen */}
      {mapExpanded && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
          {RNMaps ? (
            <RNMaps.default
              ref={mapRef}
              style={{ flex: 1 }}
              mapType="standard"
              customMapStyle={SIMPLIFIED_MAP_STYLE}
              initialRegion={mapRegion}
              loadingEnabled
              moveOnMarkerPress={false}
              toolbarEnabled={false}
              onPanDrag={() => setFollowMode(false)}
              onTouchStart={() => {
                if (followMode) setFollowMode(false);
              }}
            >
              {routeCoordinates.length > 0 && (
                <RNMaps.Polyline
                  coordinates={routeCoordinates}
                  strokeColor={ROUTE_LINE_COLOR}
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                />
              )}
              {pickupCoords && (
                Platform.OS === 'ios' ? (
                  <RNMaps.Marker coordinate={pickupCoords} title="Pickup Location" anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                    <View style={styles.customMarker}>
                      <View style={[styles.markerIconWrap, { backgroundColor: '#10B981' }]}>
                        <Package size={16} color="#FFFFFF" strokeWidth={2.5} />
                      </View>
                    </View>
                  </RNMaps.Marker>
                ) : (
                  <RNMaps.Marker coordinate={pickupCoords} title="Pickup Location" anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                    <View style={styles.customMarker}>
                      <Image source={ANDROID_MARKER_IMAGES.pickup} style={styles.markerImage} resizeMode="contain" />
                    </View>
                  </RNMaps.Marker>
                )
              )}
              {dropoffCoords && (
                Platform.OS === 'ios' ? (
                  <RNMaps.Marker coordinate={dropoffCoords} title="Dropoff Location" anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                    <View style={styles.customMarker}>
                      <View style={[styles.markerIconWrap, { backgroundColor: '#EF4444' }]}>
                        <MapPin size={16} color="#FFFFFF" strokeWidth={2.5} />
                      </View>
                    </View>
                  </RNMaps.Marker>
                ) : (
                  <RNMaps.Marker coordinate={dropoffCoords} title="Dropoff Location" anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                    <View style={styles.customMarker}>
                      <Image source={ANDROID_MARKER_IMAGES.dropoff} style={styles.markerImage} resizeMode="contain" />
                    </View>
                  </RNMaps.Marker>
                )
              )}
              {Platform.OS === 'ios' ? (
                <RNMaps.Marker
                  coordinate={{ latitude: riderCoords.latitude, longitude: riderCoords.longitude }}
                  title="Rider Location"
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <View style={styles.customMarker}>
                    <View style={[styles.markerIconWrap, { backgroundColor: theme.colors.primary || ROUTE_LINE_COLOR }]}>
                      <Bike size={16} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                  </View>
                </RNMaps.Marker>
              ) : (
                <RNMaps.Marker
                  coordinate={{ latitude: riderCoords.latitude, longitude: riderCoords.longitude }}
                  title="Rider Location"
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <View style={styles.customMarker}>
                    <Image source={ANDROID_MARKER_IMAGES.rider} style={styles.markerImage} resizeMode="contain" />
                  </View>
                </RNMaps.Marker>
              )}
            </RNMaps.default>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
              <Text style={{ color: theme.colors.text }}>Map requires a development build</Text>
            </View>
          )}
          <View style={{ position: 'absolute', top: 40, right: 20, flexDirection: 'row', gap: 10, zIndex: 10 }}>
            <TouchableOpacity
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: 24,
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                ...theme.shadows.medium,
              }}
              onPress={handleRecenterMap}
              accessibilityLabel="Recenter map on rider"
            >
              <Crosshair size={24} color={theme.colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                backgroundColor: followMode ? theme.colors.primary : theme.colors.card,
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 10,
                alignItems: 'center',
                justifyContent: 'center',
                ...theme.shadows.medium,
              }}
              onPress={() => {
                const next = !followMode;
                setFollowMode(next);
                if (next) {
                  handleRecenterMap();
                }
              }}
            >
              <Text style={{ color: followMode ? '#FFFFFF' : theme.colors.text, fontWeight: '600' }}>
                Follow
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 10,
                alignItems: 'center',
                justifyContent: 'center',
                ...theme.shadows.medium,
              }}
              onPress={() => setMapExpanded(false)}
            >
              <Text style={{ color: theme.colors.text }}>Close</Text>
            </TouchableOpacity>
          </View>

          {/* Live indicator pill */}
          <View
            style={{
              position: 'absolute',
              bottom: 240 + insets.bottom,
              left: 16,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.92)',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 20,
              zIndex: 10,
              ...theme.shadows.small,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isLive ? '#4ADE80' : theme.colors.textTertiary, marginRight: 8 }} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text }}>
              {isLive ? 'Live location' : 'Connecting…'}
            </Text>
          </View>
          <View
            style={{
              position: 'absolute',
              bottom: 200 + insets.bottom,
              left: 16,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: followMode ? `${theme.colors.primary}E6` : (isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.92)'),
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 20,
              zIndex: 10,
              ...theme.shadows.small,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: followMode ? '#FFFFFF' : theme.colors.text }}>
              {followMode ? 'FOLLOWING' : 'FREE PAN'}
            </Text>
            <Text style={{ fontSize: 12, marginLeft: 8, color: followMode ? 'rgba(255,255,255,0.9)' : theme.colors.textSecondary }}>
              {speedKmhRounded} km/h
            </Text>
          </View>

          {/* Bottom info cards - status, rider, quick actions */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              backgroundColor: theme.colors.card,
              paddingTop: 20,
              paddingHorizontal: 20,
              paddingBottom: 28 + insets.bottom,
              zIndex: 10,
              ...theme.shadows.large,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.textSecondary }}>
                  {getStatusText(displayStatus)}
                </Text>
                <Text style={{ fontSize: 13, color: theme.colors.textTertiary, marginTop: 2 }}>
                  ETA {rider.estimatedArrival}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 12, color: theme.colors.textTertiary }}>Elapsed</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.primary }}>
                  {formatTime(elapsedTime)}
                </Text>
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 20,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: theme.colors.background,
              }}
            >
              <Text style={{ fontSize: 14, color: theme.colors.textSecondary }} numberOfLines={1}>
                <Text style={{ fontWeight: '600' }}>{rider.name}</Text>
                {' · '}{rider.vehicle}
                {rider.plateNumber ? ` · ${rider.plateNumber}` : ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => {}} style={{ alignItems: 'center', width: 64 }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 6 }}>
                  <User size={24} color="#FFFFFF" strokeWidth={2} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary }}>Rider</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleMessage} style={{ alignItems: 'center', width: 64 }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: isDark ? theme.colors.surface : '#F0F2FF', justifyContent: 'center', alignItems: 'center', marginBottom: 6 }}>
                  <MessageCircle size={24} color={theme.colors.primary} strokeWidth={2} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary }}>Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCall} style={{ alignItems: 'center', width: 64 }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: theme.colors.success, justifyContent: 'center', alignItems: 'center', marginBottom: 6 }}>
                  <Phone size={24} color="#FFFFFF" strokeWidth={2} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary }}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/support')} style={{ alignItems: 'center', width: 64 }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: isDark ? theme.colors.surface : '#F0F2FF', justifyContent: 'center', alignItems: 'center', marginBottom: 6 }}>
                  <Shield size={24} color={theme.colors.primary} strokeWidth={2} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary }}>Support</Text>
              </TouchableOpacity>
            </View>
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
  customMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...Platform.select({ ios: { shadowRadius: 3, shadowOpacity: 0.25, shadowOffset: { width: 0, height: 1 }, shadowColor: '#000' }, android: { elevation: 3 } }),
  },
  markerImage: {
    width: 50,
    height: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  liveBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  liveDotActive: {
    backgroundColor: '#4ADE80',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  mapContainer: {
    height: 280,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    margin: 16,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    padding:   10,
  },
  statusCard: {
    borderRadius: 10,
    padding: 10,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  elapsedTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  estimatedArrival: {
    fontSize: 11,
  },
  riderCard: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
  },
  riderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  riderAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  riderInfo: {
    flex: 1,
  },
  riderName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  riderRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  messageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderDetails: {
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  quickActionsSection: {
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    minWidth: 0,
  },
  quickActionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  verifiedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  infoCardContent: {
    flex: 1,
    minWidth: 0,
  },
  infoCardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoCardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  stepsContainer: {
    margin: 20,
    marginTop: 0,
    borderRadius: 16,
    padding: 20,
  },
  stepsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  completedStep: {
    backgroundColor: '#10B981',
  },
  currentStep: {
    backgroundColor: '#5A47FF',
  },
  stepCheckmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepText: {
    fontSize: 14,
    flex: 1,
  },
  bottomContainer: {
    padding: 20,
  },
  deliveredButton: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveredText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
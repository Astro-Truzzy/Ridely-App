import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Share,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  MessageCircle,
  Phone,
  Package,
  User,
  Shield,
  MapPin,
  CreditCard,
  Crosshair,
  Share2,
  KeyRound,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert, type AlertButton } from '@/contexts/AlertContext';
import { useVoiceCall } from '@/contexts/VoiceCallContext';
import { useDeliveries, type Delivery } from '@/hooks/useDeliveries';
import { useAutoCancelPendingDelivery } from '@/hooks/useAutoCancelPendingDelivery';
import { fetchGoogleDirections, geocodeAddress } from '@/lib/googleDirections';
import { getDeliveryProofSignedUrl } from '@/lib/deliveryProofUpload';
import { firstParam } from '@/lib/screenContracts';

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

function mapDeliveryToDisplayStatus(
  status: Delivery['status'] | undefined,
): DisplayStatus {
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

const MARKER_IMAGES = {
  rider: require('@/assets/markers/marker-rider.png'),
  pickup: require('@/assets/markers/ridely_brand_pin_256.png'),
  dropoff: require('@/assets/markers/ridely_dropoff_pin_green_256.png'),
};

/** All markers are teardrop pins; the tip sits on the coordinate. */
const MARKER_ANCHOR = {
  pin: { x: 0.5, y: 1 },
  rider: { x: 0.5, y: 1 },
} as const;

type LatLng = { latitude: number; longitude: number };

const DEFAULT_DELTA = { latitudeDelta: 0.05, longitudeDelta: 0.05 };

function DeliveryMapMarkers({
  Marker,
  pickupCoords,
  dropoffCoords,
  riderCoords,
}: {
  Marker: React.ComponentType<any>;
  pickupCoords: LatLng | null;
  dropoffCoords: LatLng | null;
  riderCoords: LatLng | null;
}) {
  return (
    <>
      {pickupCoords && (
        <Marker
          coordinate={pickupCoords}
          title="Pickup Location"
          image={MARKER_IMAGES.pickup}
          anchor={MARKER_ANCHOR.pin}
          tracksViewChanges={false}
        />
      )}
      {dropoffCoords && (
        <Marker
          coordinate={dropoffCoords}
          title="Dropoff Location"
          image={MARKER_IMAGES.dropoff}
          anchor={MARKER_ANCHOR.pin}
          tracksViewChanges={false}
        />
      )}
      {riderCoords && (
        <Marker
          coordinate={riderCoords}
          title="Rider Location"
          image={MARKER_IMAGES.rider}
          anchor={MARKER_ANCHOR.rider}
          tracksViewChanges={false}
        />
      )}
    </>
  );
}

function firstNameOnly(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || 'Rider';
}

function regionFromPoints(points: LatLng[]) {
  if (points.length === 0) return null;
  if (points.length === 1) {
    return { ...points[0], ...DEFAULT_DELTA };
  }
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

// Simplified map style: light background, soft roads/labels (lower contrast for readability).
const SIMPLIFIED_MAP_STYLE = [
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#e8eaed' }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#f8f8f8' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#e5e5e5' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#d8d8d8' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#e5e5e5' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{ color: '#ebebeb' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry.fill',
    stylers: [{ color: '#c8e6c9' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#a8a8a8' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'simplified' }, { saturation: 0 }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#a8a8a8' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ visibility: 'on' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#e5e5e5' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#a8a8a8' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#fafafa' }],
  },
  {
    featureType: 'administrative',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#a8a8a8' }],
  },
];

const ROUTE_LINE_COLOR = '#22C55E';

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
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
  const { showAlert } = useAlert();
  const { startCall } = useVoiceCall();
  const { deliveries } = useDeliveries();
  const params = useLocalSearchParams<{ deliveryId?: string | string[] }>();
  const requestedDeliveryId = firstParam(params.deliveryId);

  // Get active delivery - from params or most recent non-completed (including pending "searching for rider")
  const activeDeliveryFromList = requestedDeliveryId
    ? deliveries.find((d) => d.id === requestedDeliveryId)
    : deliveries.find(
        (d) =>
          d.status !== 'delivered' &&
          d.status !== 'cancelled' &&
          d.status !== 'cancelled_no_rider' &&
          d.status !== 'completed',
      );

  const [localDelivery, setLocalDelivery] = useState<
    typeof activeDeliveryFromList
  >(activeDeliveryFromList);
  const activeDelivery = localDelivery ?? activeDeliveryFromList;
  const riderId = activeDelivery?.rider_id || null;
  const isSearchingForRider = activeDelivery && !riderId;

  // Trigger auto-cancel after 2 min when user is on tracking and still "searching for rider"
  useAutoCancelPendingDelivery(
    activeDelivery?.status === 'pending' && !activeDelivery?.rider_id
      ? activeDelivery
      : null,
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
          setLocalDelivery((prev) =>
            prev
              ? { ...prev, ...payload.new }
              : (payload.new as unknown as Delivery),
          );
        },
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
        if (mounted)
          setRNMaps({
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

  const displayStatus = useMemo(
    () => mapDeliveryToDisplayStatus(activeDelivery?.status),
    [activeDelivery?.status],
  );
  const progressIndex = useMemo(
    () => getProgressIndex(activeDelivery?.status),
    [activeDelivery?.status],
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Real-time rider coordinates — null until we have a real GPS sample (never invent a city).
  const [riderCoords, setRiderCoords] = useState<LatLng | null>(null);
  const [isLive, setIsLive] = useState(false);
  const subscriptionRef = useRef<any | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<
    Array<{ latitude: number; longitude: number }>
  >([]);
  const [pickupCoords, setPickupCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [fallbackCoords, setFallbackCoords] = useState<LatLng | null>(null);
  const [followMode, setFollowMode] = useState(true);
  const [riderSpeedKmh, setRiderSpeedKmh] = useState(0);
  const [handoffCode, setHandoffCode] = useState<string | null>(null);
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string | null>(null);
  const lastRiderSampleRef = useRef<{
    lat: number;
    lng: number;
    ts: number;
  } | null>(null);
  const mapRef = useRef<any>(null);

  const handleRecenterMap = () => {
    if (!riderCoords) return;
    setFollowMode(true);
    mapRef.current?.animateCamera?.(
      {
        center: {
          latitude: riderCoords.latitude,
          longitude: riderCoords.longitude,
        },
        zoom: getZoomForSpeed(riderSpeedKmh),
      },
      { duration: 450 },
    );
  };

  const mapRegion = useMemo(
    () =>
      regionFromPoints(
        [riderCoords, pickupCoords, dropoffCoords, fallbackCoords].filter(
          (p): p is LatLng => !!p,
        ),
      ),
    [
      riderCoords?.latitude,
      riderCoords?.longitude,
      pickupCoords?.latitude,
      pickupCoords?.longitude,
      dropoffCoords?.latitude,
      dropoffCoords?.longitude,
      fallbackCoords?.latitude,
      fallbackCoords?.longitude,
    ],
  );
  const speedKmhRounded = Math.max(0, Math.round(riderSpeedKmh));

  useEffect(() => {
    if (!mapRef.current) return;
    const fitPoints =
      routeCoordinates.length > 1
        ? routeCoordinates
        : [riderCoords, pickupCoords, dropoffCoords].filter(
            (p): p is LatLng => !!p,
          );
    if (fitPoints.length < 2) return;
    mapRef.current.fitToCoordinates?.(fitPoints, {
      edgePadding: {
        top: 90,
        right: 60,
        bottom: detailsOpen ? 420 : 280,
        left: 60,
      },
      animated: true,
    });
  }, [
    detailsOpen,
    routeCoordinates.length,
    pickupCoords?.latitude,
    pickupCoords?.longitude,
    dropoffCoords?.latitude,
    dropoffCoords?.longitude,
  ]);

  useEffect(() => {
    if (!followMode || !mapRef.current || !riderCoords) return;
    mapRef.current.animateCamera?.(
      {
        center: {
          latitude: riderCoords.latitude,
          longitude: riderCoords.longitude,
        },
        zoom: getZoomForSpeed(riderSpeedKmh),
      },
      { duration: 500 },
    );
  }, [
    followMode,
    riderCoords?.latitude,
    riderCoords?.longitude,
    riderSpeedKmh,
  ]);

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

        const row = data as {
          full_name?: string;
          rating?: number;
          phone?: string;
          vehicle_type?: string | null;
          plate_number?: string | null;
        } | null;
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

    const handleLocationPayload = (payload: {
      new?: { latitude: number; longitude: number };
    }) => {
      if (!payload.new) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const next = payload.new!;
        const now = Date.now();
        const prev = lastRiderSampleRef.current;
        if (prev) {
          const meters = haversineMeters(
            prev.lat,
            prev.lng,
            next.latitude,
            next.longitude,
          );
          const seconds = Math.max((now - prev.ts) / 1000, 1);
          const kmh = (meters / seconds) * 3.6;
          setRiderSpeedKmh((old) => old * 0.7 + Math.min(kmh, 120) * 0.3);
        }
        lastRiderSampleRef.current = {
          lat: next.latitude,
          lng: next.longitude,
          ts: now,
        };
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
      on(
        ev: string,
        cfg: object,
        cb: (p: { new?: { latitude: number; longitude: number } }) => void,
      ): ChannelWithPostgres;
    };
    const channel = (
      supabase.channel(`rider-location:${riderId}`) as ChannelWithPostgres
    )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rider_locations',
          filter: `rider_id=eq.${riderId}`,
        },
        handleLocationPayload,
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rider_locations',
          filter: `rider_id=eq.${riderId}`,
        },
        handleLocationPayload,
      )
      .subscribe();

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
          if (
            typeof location.latitude === 'number' &&
            typeof location.longitude === 'number' &&
            Number.isFinite(location.latitude) &&
            Number.isFinite(location.longitude)
          ) {
            setRiderCoords({
              latitude: location.latitude,
              longitude: location.longitude,
            });
            setIsLive(true);
          }
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

  // Resolve pickup/dropoff coords from DB first (independently), then geocode any gaps.
  useEffect(() => {
    if (!activeDelivery) return;

    const hasPickupDb =
      activeDelivery.pickup_lat != null &&
      activeDelivery.pickup_lng != null &&
      Number.isFinite(Number(activeDelivery.pickup_lat)) &&
      Number.isFinite(Number(activeDelivery.pickup_lng));
    const hasDropoffDb =
      activeDelivery.dropoff_lat != null &&
      activeDelivery.dropoff_lng != null &&
      Number.isFinite(Number(activeDelivery.dropoff_lat)) &&
      Number.isFinite(Number(activeDelivery.dropoff_lng));

    if (hasPickupDb) {
      setPickupCoords({
        latitude: Number(activeDelivery.pickup_lat),
        longitude: Number(activeDelivery.pickup_lng),
      });
    }
    if (hasDropoffDb) {
      setDropoffCoords({
        latitude: Number(activeDelivery.dropoff_lat),
        longitude: Number(activeDelivery.dropoff_lng),
      });
    }
    if (hasPickupDb && hasDropoffDb) return;

    let cancelled = false;
    (async () => {
      const tasks: Promise<void>[] = [];
      if (!hasPickupDb && activeDelivery.pickup_address) {
        tasks.push(
          geocodeAddress(activeDelivery.pickup_address).then((pickup) => {
            if (!cancelled && pickup) setPickupCoords(pickup);
          }),
        );
      }
      if (!hasDropoffDb && activeDelivery.dropoff_address) {
        tasks.push(
          geocodeAddress(activeDelivery.dropoff_address).then((dropoff) => {
            if (!cancelled && dropoff) setDropoffCoords(dropoff);
          }),
        );
      }
      await Promise.all(tasks);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activeDelivery?.id,
    activeDelivery?.pickup_address,
    activeDelivery?.dropoff_address,
    activeDelivery?.pickup_lat,
    activeDelivery?.pickup_lng,
    activeDelivery?.dropoff_lat,
    activeDelivery?.dropoff_lng,
  ]);

  // If list/realtime didn't include coords yet, fetch this delivery row once.
  useEffect(() => {
    if (!deliveryId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('deliveries')
          .select(
            'pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, share_token, status, rider_id',
          )
          .eq('id', deliveryId)
          .maybeSingle();
        if (cancelled || error || !data) return;
        setLocalDelivery((prev) =>
          prev ? { ...prev, ...data } : (data as Delivery),
        );
      } catch (err) {
        console.warn('[tracking] delivery coords fetch failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deliveryId]);

  // Last-resort map center: device location so we never stick on a blank "Locating" forever.
  useEffect(() => {
    if (riderCoords || pickupCoords || dropoffCoords || fallbackCoords) return;
    let cancelled = false;
    (async () => {
      try {
        const Location = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setFallbackCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      } catch (err) {
        console.warn('[tracking] device location fallback failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [riderCoords, pickupCoords, dropoffCoords, fallbackCoords]);

  // Fetch handoff OTP for customer when package is picked up
  useEffect(() => {
    if (!deliveryId) return;
    const showCode =
      activeDelivery?.status === 'picked_up' ||
      activeDelivery?.status === 'in_transit' ||
      activeDelivery?.status === 'nearby';
    if (!showCode) {
      setHandoffCode(null);
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from('delivery_handoffs')
        .select('code, verified')
        .eq('delivery_id', deliveryId)
        .maybeSingle();
      if (data && !data.verified) {
        setHandoffCode(data.code);
      } else {
        setHandoffCode(null);
      }
    })();
  }, [deliveryId, activeDelivery?.status]);

  // Load proof-of-delivery photo when delivered
  useEffect(() => {
    if (!activeDelivery?.proof_photo_path) {
      setProofPhotoUrl(null);
      return;
    }
    if (
      activeDelivery.status !== 'delivered' &&
      activeDelivery.status !== 'completed'
    ) {
      return;
    }
    (async () => {
      const url = await getDeliveryProofSignedUrl(
        activeDelivery.proof_photo_path!,
      );
      setProofPhotoUrl(url);
    })();
  }, [activeDelivery?.proof_photo_path, activeDelivery?.status]);

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
    const rider = riderCoordsRef.current;
    if (!drop || !rider) return;

    const fetchRouteAndEta = async () => {
      const currentRider = riderCoordsRef.current;
      const currentDrop = dropoffCoordsRef.current;
      if (!currentRider || !currentDrop) return;
      const result = await fetchGoogleDirections(
        currentRider.latitude,
        currentRider.longitude,
        currentDrop.latitude,
        currentDrop.longitude,
      );
      if (!result) return;
      setRouteCoordinates(result.coordinates);
      const mins = Math.round(result.durationSeconds / 60);
      const etaText =
        mins < 1 ? '< 1 min' : mins === 1 ? '1 min' : `${mins} mins`;
      setRider((prev) => ({ ...prev, estimatedArrival: etaText }));
    };

    const now = Date.now();
    const timeSinceLastFetch = now - lastRouteFetchRef.current;
    const isFirstFetch =
      timeSinceLastFetch > ROUTE_DEBOUNCE_MS || lastRouteFetchRef.current === 0;

    if (isFirstFetch) {
      lastRouteFetchRef.current = now;
      fetchRouteAndEta();
      return () => {
        if (routeFetchRef.current) clearTimeout(routeFetchRef.current);
      };
    }

    if (routeFetchRef.current) clearTimeout(routeFetchRef.current);
    routeFetchRef.current = setTimeout(
      () => {
        routeFetchRef.current = null;
        lastRouteFetchRef.current = Date.now();
        fetchRouteAndEta();
      },
      Math.max(0, ROUTE_DEBOUNCE_MS - timeSinceLastFetch),
    );

    return () => {
      if (routeFetchRef.current) clearTimeout(routeFetchRef.current);
    };
  }, [
    dropoffCoords?.latitude,
    dropoffCoords?.longitude,
    riderCoords?.latitude,
    riderCoords?.longitude,
  ]);

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
    if (!activeDelivery?.id || !riderId) {
      showAlert('Call Rider', 'A rider must be assigned before you can call.');
      return;
    }

    const riderName =
      rider.name && rider.name !== 'Loading...' ? rider.name : 'Rider';
    const buttons: AlertButton[] = [
      {
        text: 'In-App Call',
        onPress: () => {
          startCall(activeDelivery.id, riderName).catch(() => {});
        },
      },
    ];

    if (rider.phone) {
      buttons.push({
        text: 'Phone Call',
        onPress: () => {
          Linking.openURL(`tel:${rider.phone}`).catch(() => {});
        },
      });
    }

    buttons.push({ text: 'Cancel', style: 'cancel' });
    showAlert(
      'Call Rider',
      `Choose how you want to call ${riderName}`,
      buttons,
    );
  };

  const handleMessage = () => {
    if (!activeDelivery?.id || !riderId) return;
    router.push({
      pathname: '/chat',
      params: {
        deliveryId: activeDelivery.id,
        peerName: rider.name && rider.name !== 'Loading...' ? rider.name : '',
        peerPhone: rider.phone ?? '',
      },
    });
  };

  const handleShareTracking = async () => {
    if (!activeDelivery?.share_token) {
      showAlert('Share', 'Tracking link is not available for this delivery.');
      return;
    }
    const webUrl =
      process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '') ??
      process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
    const link = `${webUrl}/track/${activeDelivery.share_token}`;
    try {
      await Share.share({
        message: `Track my Ridely delivery live: ${link}`,
        url: link,
        title: 'Ridely delivery tracking',
      });
    } catch (_) {}
  };

  const riderFirst =
    rider.name && rider.name !== 'Loading...'
      ? firstNameOnly(rider.name)
      : 'Rider';
  const canContact = !!riderId && !isSearchingForRider;
  const primaryAction: 'call' | 'chat' | 'share' = !canContact
    ? 'share'
    : displayStatus === 'delivered' ||
        displayStatus === 'completed' ||
        displayStatus === 'cancelled'
      ? 'chat'
      : 'call';

  const runPrimaryAction = () => {
    if (primaryAction === 'call') handleCall();
    else if (primaryAction === 'chat') handleMessage();
    else void handleShareTracking();
  };

  const primaryLabel =
    primaryAction === 'call'
      ? `Call ${riderFirst}`
      : primaryAction === 'chat'
        ? `Chat with ${riderFirst}`
        : 'Share tracking';
  const PrimaryIcon =
    primaryAction === 'call'
      ? Phone
      : primaryAction === 'chat'
        ? MessageCircle
        : Share2;
  const statusTitle = isSearchingForRider
    ? 'Finding your rider'
    : getStatusText(displayStatus);
  const etaLabel = isSearchingForRider
    ? 'ETA —'
    : rider.estimatedArrival && rider.estimatedArrival !== 'Calculating...'
      ? `ETA ${rider.estimatedArrival}`
      : 'ETA calculating…';
  const sheetMaxHeight = Math.round(
    Dimensions.get('window').height * (detailsOpen ? 0.72 : 0.42),
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <StatusBar style="light" />

      <View
        style={[
          styles.mapFill,
          { backgroundColor: isDark ? theme.colors.card : '#E5E7EB' },
        ]}
      >
        {RNMaps && mapRegion ? (
          <RNMaps.default
            ref={mapRef}
            style={StyleSheet.absoluteFill}
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
            <DeliveryMapMarkers
              Marker={RNMaps.Marker}
              pickupCoords={pickupCoords}
              dropoffCoords={dropoffCoords}
              riderCoords={riderCoords}
            />
          </RNMaps.default>
        ) : (
          <View style={styles.mapFallback}>
            {RNMaps ? (
              <>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text
                  style={{ color: theme.colors.textSecondary, marginTop: 12 }}
                >
                  Locating delivery…
                </Text>
              </>
            ) : (
              <Text style={{ color: theme.colors.textSecondary }}>
                Map requires a development build
              </Text>
            )}
          </View>
        )}

        <View style={[styles.mapChrome, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={[styles.roundBtn, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={22} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>
          {riderId ? (
            <View style={[styles.livePill, isLive && styles.livePillActive]}>
              <View style={[styles.liveDot, isLive && styles.liveDotActive]} />
              <Text style={styles.liveText}>
                {isLive ? 'Live' : 'Connecting…'}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <TouchableOpacity
            style={[
              styles.roundBtn,
              {
                backgroundColor: followMode
                  ? theme.colors.primary
                  : 'rgba(0,0,0,0.55)',
              },
            ]}
            onPress={handleRecenterMap}
          >
            <Crosshair size={20} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.card,
            maxHeight: sheetMaxHeight,
            height: detailsOpen ? sheetMaxHeight : undefined,
            paddingBottom: Math.max(insets.bottom, 12),
            ...theme.shadows.large,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.sheetHandleHit}
          onPress={() => setDetailsOpen((open) => !open)}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.sheetHandle,
              { backgroundColor: theme.colors.border },
            ]}
          />
        </TouchableOpacity>

        <View style={styles.leadRow}>
          <View style={styles.leadCopy}>
            <View style={styles.statusDotRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: getStatusColor(displayStatus) },
                ]}
              />
              <Text
                style={[styles.statusTitle, { color: theme.colors.text }]}
                numberOfLines={1}
              >
                {statusTitle}
              </Text>
            </View>
            <Text style={[styles.etaText, { color: theme.colors.primary }]}>
              {etaLabel}
            </Text>
          </View>
          <Text style={[styles.elapsed, { color: theme.colors.textTertiary }]}>
            {formatTime(elapsedTime)}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.primaryAction,
              {
                backgroundColor:
                  primaryAction === 'call'
                    ? theme.colors.success
                    : theme.colors.primary,
                opacity: primaryAction !== 'share' && !canContact ? 0.5 : 1,
              },
            ]}
            onPress={runPrimaryAction}
            disabled={primaryAction !== 'share' && !canContact}
          >
            <PrimaryIcon size={20} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.primaryActionText}>{primaryLabel}</Text>
          </TouchableOpacity>

          {primaryAction !== 'call' ? (
            <TouchableOpacity
              style={[
                styles.secondaryAction,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={handleCall}
              disabled={!canContact}
            >
              <Phone
                size={20}
                color={
                  canContact ? theme.colors.text : theme.colors.textTertiary
                }
                strokeWidth={2}
              />
            </TouchableOpacity>
          ) : null}
          {primaryAction !== 'chat' ? (
            <TouchableOpacity
              style={[
                styles.secondaryAction,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={handleMessage}
              disabled={!canContact}
            >
              <MessageCircle
                size={20}
                color={
                  canContact ? theme.colors.text : theme.colors.textTertiary
                }
                strokeWidth={2}
              />
            </TouchableOpacity>
          ) : null}
          {primaryAction !== 'share' ? (
            <TouchableOpacity
              style={[
                styles.secondaryAction,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={handleShareTracking}
            >
              <Share2 size={20} color={theme.colors.text} strokeWidth={2} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={() => setDetailsOpen((open) => !open)}
          activeOpacity={0.7}
        >
          <Text style={[styles.detailsToggle, { color: theme.colors.primary }]}>
            {detailsOpen ? 'Hide details' : 'Delivery details'}
          </Text>
        </TouchableOpacity>

        {detailsOpen ? (
          <ScrollView
            style={styles.detailsScroll}
            contentContainerStyle={styles.detailsContent}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.detailCard,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <View style={styles.riderHeader}>
                <View
                  style={[
                    styles.riderAvatar,
                    { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <User size={22} color="#FFFFFF" strokeWidth={2} />
                </View>
                <View style={styles.riderInfo}>
                  <Text
                    style={[styles.riderName, { color: theme.colors.text }]}
                  >
                    {isSearchingForRider ? 'Looking for a rider…' : rider.name}
                  </Text>
                  {!isSearchingForRider ? (
                    <Text
                      style={[
                        styles.riderMeta,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {rider.vehicle}
                      {rider.plateNumber ? ` · ${rider.plateNumber}` : ''}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {handoffCode ? (
              <View
                style={[
                  styles.handoffCard,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                <KeyRound size={22} color="#FFFFFF" strokeWidth={2} />
                <View style={styles.handoffContent}>
                  <Text style={styles.handoffLabel}>
                    Handoff code — share with rider
                  </Text>
                  <Text style={styles.handoffCode}>{handoffCode}</Text>
                </View>
              </View>
            ) : null}

            <View
              style={[
                styles.detailCard,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <View style={styles.addressRow}>
                <MapPin
                  size={18}
                  color={theme.colors.primary}
                  strokeWidth={2}
                />
                <View style={styles.infoCardContent}>
                  <Text
                    style={[styles.infoCardTitle, { color: theme.colors.text }]}
                    numberOfLines={2}
                  >
                    {activeDelivery?.dropoff_address || 'Dropoff address'}
                  </Text>
                  <Text
                    style={[
                      styles.infoCardSubtitle,
                      { color: theme.colors.textTertiary },
                    ]}
                  >
                    {activeDelivery?.pickup_address
                      ? `From ${activeDelivery.pickup_address}`
                      : 'Delivery destination'}
                  </Text>
                </View>
              </View>
              <View
                style={[styles.feeRow, { borderTopColor: theme.colors.border }]}
              >
                <CreditCard
                  size={18}
                  color={theme.colors.primary}
                  strokeWidth={2}
                />
                <Text
                  style={[
                    styles.infoCardTitle,
                    { color: theme.colors.text, marginLeft: 10 },
                  ]}
                >
                  ₦
                  {activeDelivery?.total_cost != null
                    ? Number(activeDelivery.total_cost).toLocaleString('en-NG')
                    : '—'}
                </Text>
              </View>
            </View>

            {proofPhotoUrl ? (
              <View
                style={[
                  styles.detailCard,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                <Text style={[styles.stepsTitle, { color: theme.colors.text }]}>
                  Proof of delivery
                </Text>
                <Image
                  source={{ uri: proofPhotoUrl }}
                  style={styles.proofImage}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            <View
              style={[
                styles.detailCard,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <Text style={[styles.stepsTitle, { color: theme.colors.text }]}>
                Progress
              </Text>
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
                          isCompleted && {
                            backgroundColor: theme.colors.success,
                          },
                          isCurrent && {
                            backgroundColor: theme.colors.primary,
                          },
                          !isCompleted &&
                            !isCurrent && {
                              backgroundColor: theme.colors.border,
                            },
                        ]}
                      >
                        {isCompleted ? (
                          <Text style={styles.stepCheckmark}>✓</Text>
                        ) : (
                          <Text
                            style={[
                              styles.stepNumber,
                              { color: theme.colors.textSecondary },
                            ]}
                          >
                            {index + 1}
                          </Text>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.stepText,
                          {
                            color:
                              isCurrent || isCompleted
                                ? theme.colors.text
                                : theme.colors.textSecondary,
                          },
                          isCurrent && { fontWeight: '600' },
                        ]}
                      >
                        {step.text}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            {displayStatus !== 'delivered' &&
            displayStatus !== 'completed' &&
            displayStatus !== 'cancelled' &&
            activeDelivery?.rider_id ? (
              <View
                style={[
                  styles.waitingRow,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                <Package
                  size={18}
                  color={theme.colors.textSecondary}
                  strokeWidth={2}
                />
                <Text
                  style={[
                    styles.waitingText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Waiting for rider to confirm delivery
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.supportLink, { borderColor: theme.colors.border }]}
              onPress={() => router.push('/support')}
            >
              <Shield
                size={16}
                color={theme.colors.textSecondary}
                strokeWidth={2}
              />
              <Text
                style={[
                  styles.supportLinkText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Safety & support
              </Text>
            </TouchableOpacity>
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapFill: {
    flex: 1,
  },
  mapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapChrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  livePillActive: {
    backgroundColor: 'rgba(0,0,0,0.55)',
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
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  sheetHandleHit: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  leadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  leadCopy: {
    flex: 1,
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: '800',
    flex: 1,
  },
  etaText: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '700',
  },
  elapsed: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  primaryAction: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryAction: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsToggle: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  detailsScroll: {
    marginTop: 12,
    flex: 1,
  },
  detailsContent: {
    paddingBottom: 8,
    gap: 12,
  },
  detailCard: {
    borderRadius: 16,
    padding: 16,
  },
  riderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  riderInfo: {
    flex: 1,
  },
  riderName: {
    fontSize: 17,
    fontWeight: '700',
  },
  riderMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
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
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepCheckmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
  },
  stepText: {
    fontSize: 14,
    flex: 1,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
  },
  waitingText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  supportLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  handoffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 14,
  },
  handoffContent: { flex: 1 },
  handoffLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  handoffCode: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 6,
  },
  proofImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
  },
});

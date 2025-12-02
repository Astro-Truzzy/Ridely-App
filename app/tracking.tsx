import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  PanResponder,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MessageCircle,
  Phone,
  Package,
  User,
  Star,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDeliveries } from '@/hooks/useDeliveries';
import MapView, { Marker, Polyline } from 'react-native-maps';

interface RiderInfo {
  name: string;
  rating: number;
  phone: string;
  vehicle: string;
  plateNumber: string;
  estimatedArrival: string;
  currentLocation: string;
}

type DeliveryStatus =
  | 'rider_assigned'
  | 'pickup_arrived'
  | 'picked_up'
  | 'in_transit'
  | 'nearby'
  | 'delivered'
  | 'feedback_requested'
  | 'completed';

export default function TrackingScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { deliveries } = useDeliveries();
  const params = useLocalSearchParams<{ deliveryId?: string }>();
  
  // Get active delivery - either from params or find the most recent active one
  const activeDelivery = params.deliveryId 
    ? deliveries.find(d => d.id === params.deliveryId)
    : deliveries.find(d => 
        d.status !== 'delivered' && 
        d.status !== 'cancelled' && 
        d.rider_id !== null
      );
  
  const riderId = activeDelivery?.rider_id || null;
  
  const [deliveryStatus, setDeliveryStatus] =
    useState<DeliveryStatus>('in_transit');
  const [rider, setRider] = useState<RiderInfo>({
    name: 'Loading...',
    rating: 0,
    phone: '',
    vehicle: '',
    plateNumber: '',
    estimatedArrival: 'Calculating...',
    currentLocation: '',
  });
  const [elapsedTime, setElapsedTime] = useState(540); // 14 minutes in seconds
  const [mapExpanded, setMapExpanded] = useState(false);
  // Real-time rider coordinates
  const [riderCoords, setRiderCoords] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
  });
  const subscriptionRef = useRef<any | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  
  // Draggable card state
  const [cardPosition, setCardPosition] = useState({ x: 20, y: 100 }); // Position below header
  const initialPosition = useRef({ x: 20, y: 100 });
  
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

  // Helper function to fetch route coordinates from Mapbox Directions API
  const fetchRouteCoordinates = async (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
    
    if (!mapboxToken) {
      console.warn('Mapbox token not configured');
      return [];
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${lon1},${lat1};${lon2},${lat2}?geometries=geojson&access_token=${mapboxToken}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch route');
      }

      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map((coord: [number, number]) => ({
          latitude: coord[1],
          longitude: coord[0],
        }));
        return coordinates;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching route coordinates:', error);
      return [];
    }
  };

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

        if (data) {
          setRider({
            name: data.full_name || 'Rider',
            rating: data.rating || 5.0,
            phone: data.phone || '',
            vehicle: data.vehicle_type || 'Motorcycle',
            plateNumber: data.plate_number || '',
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

  // Subscribe to Supabase Realtime for rider location
  useEffect(() => {
    if (!riderId) {
      console.warn(
        '[tracking] Missing RIDER_ID — realtime subscription skipped. No active delivery with assigned rider.'
      );
      return;
    }

    const channel = supabase
      .channel(`rider-location:${riderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rider_locations',
          filter: `rider_id=eq.${riderId}`,
        },
        (payload) => {
          if (payload.new) {
            setRiderCoords({
              latitude: payload.new.latitude,
              longitude: payload.new.longitude,
            });
          }
        }
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
          .single();

        if (error) {
          console.warn('[tracking] initial location fetch error', error);
          return;
        }
        if (data) {
          const location = data as { latitude: number; longitude: number };
          setRiderCoords({
            latitude: location.latitude,
            longitude: location.longitude,
          });
        }
      } catch (err) {
        console.warn('[tracking] fetch error', err);
      }
    })();

    return () => {
      // Clean up subscription safely
      try {
        if (subscriptionRef.current) {
          // supabase.removeChannel can accept the channel object or the channel name
          supabase
            .removeChannel(subscriptionRef.current)
            .catch((e: any) =>
              console.warn('[tracking] removeChannel error', e)
            );
          subscriptionRef.current = null;
        }
      } catch (e) {
        console.warn('[tracking] subscription cleanup failed', e);
      }
    };
  }, [riderId]);

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
      case 'rider_assigned':
        return 'Rider Assigned';
      case 'pickup_arrived':
        return 'Rider at Pickup';
      case 'picked_up':
        return 'Package Picked Up';
      case 'in_transit':
        return 'In Transit';
      case 'nearby':
        return 'Rider Nearby';
      case 'delivered':
        return 'Delivered';
      case 'feedback_requested':
        return 'Feedback Requested';
      case 'completed':
        return 'Delivery Completed';
      default:
        return 'Processing';
    }
  };

  const getStatusColor = (status: DeliveryStatus) => {
    switch (status) {
      case 'rider_assigned':
        return theme.colors.accent;
      case 'pickup_arrived':
        return theme.colors.info;
      case 'picked_up':
        return '#8B5CF6';
      case 'in_transit':
        return theme.colors.primary;
      case 'nearby':
        return theme.colors.warning;
      case 'delivered':
        return theme.colors.success;
      case 'feedback_requested':
        return theme.colors.info;
      case 'completed':
        return '#8B5CF6';
      default:
        return theme.colors.textTertiary;
    }
  };

  const handleCall = () => {
    Alert.alert('Call Rider', 'Choose how you want to call Mike', [
      {
        text: 'In-App Call',
        onPress: () =>
          Alert.alert('In-App Call', 'Starting in-app call with Mike...'),
      },
      {
        text: 'Phone Call',
        onPress: () => Alert.alert('Phone Call', `Calling ${rider.phone}...`),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleMessage = () => {
    router.push('/chat');
  };

  const handleMarkDelivered = () => {
    Alert.alert('Confirm Delivery', 'Has your package been delivered?', [
      { text: 'No, Not Yet', style: 'cancel' },
      {
        text: 'Yes, Delivered',
        onPress: () => {
          setDeliveryStatus('delivered');
          Alert.alert(
            'Delivery Confirmed',
            'Thank you! Your delivery has been marked as completed.'
          );
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.title}>Track Delivery</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Map Area with Preview and Tap-to-Expand */}
        <TouchableOpacity
          style={[styles.mapContainer, { backgroundColor: isDark ? theme.colors.card : '#E5E7EB' }]}
          activeOpacity={0.8}
          onPress={() => setMapExpanded(true)}
        >
          <MapView
            key={`map-${riderCoords.latitude}-${riderCoords.longitude}`}
            style={styles.map}
            initialRegion={{
              latitude: riderCoords.latitude,
              longitude: riderCoords.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            region={{
              latitude: riderCoords.latitude,
              longitude: riderCoords.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            {/* Route polyline */}
            {routeCoordinates.length > 0 && (
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#5A47FF"
                strokeWidth={4}
                lineCap="round"
                lineJoin="round"
              />
            )}
            
            {/* Pickup marker */}
            {pickupCoords && (
              <Marker
                coordinate={pickupCoords}
                title="Pickup Location"
                pinColor="#10B981"
              />
            )}
            
            {/* Dropoff marker */}
            {dropoffCoords && (
              <Marker
                coordinate={dropoffCoords}
                title="Dropoff Location"
                pinColor="#EF4444"
              />
            )}
            
            {/* Rider marker */}
            <Marker
              coordinate={{
                latitude: riderCoords.latitude,
                longitude: riderCoords.longitude,
              }}
              title="Rider Location"
              pinColor={theme.colors.primary}
            />
          </MapView>
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
                zIndex: 100, // Ensure it's on top
                width: 300, // Fixed width to prevent shrinking
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
                    { backgroundColor: getStatusColor(deliveryStatus) },
                  ]}
                />
                <Text style={[styles.statusText, { color: theme.colors.text }]}>
                  {getStatusText(deliveryStatus)}
                </Text>
              </View>
              <Text style={[styles.elapsedTime, { color: theme.colors.primary }]}>{formatTime(elapsedTime)}</Text>
            </View>
            <Text style={[styles.estimatedArrival, { color: theme.colors.textSecondary }]}>
              Estimated arrival: {rider.estimatedArrival}
            </Text>
          </TouchableOpacity>
        )}

        {/* Fullscreen Map Modal */}
        {mapExpanded && (
          <View style={StyleSheet.absoluteFill}>
            <MapView
              key={`map-expanded-${riderCoords.latitude}-${riderCoords.longitude}`}
              style={{ flex: 1 }}
              initialRegion={{
                latitude: riderCoords.latitude,
                longitude: riderCoords.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              region={{
                latitude: riderCoords.latitude,
                longitude: riderCoords.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              {/* Route polyline */}
              {routeCoordinates.length > 0 && (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="#5A47FF"
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                />
              )}
              
              {/* Pickup marker */}
              {pickupCoords && (
                <Marker
                  coordinate={pickupCoords}
                  title="Pickup Location"
                  pinColor="#10B981"
                />
              )}
              
              {/* Dropoff marker */}
              {dropoffCoords && (
                <Marker
                  coordinate={dropoffCoords}
                  title="Dropoff Location"
                  pinColor="#EF4444"
                />
              )}
              
              {/* Rider marker */}
              <Marker
                coordinate={{
                  latitude: riderCoords.latitude,
                  longitude: riderCoords.longitude,
                }}
                title="Rider Location"
                pinColor={theme.colors.primary}
              />
            </MapView>
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 40,
                right: 20,
                backgroundColor: theme.colors.card,
                borderRadius: 20,
                padding: 10,
                zIndex: 10,
                ...theme.shadows.medium,
              }}
              onPress={() => setMapExpanded(false)}
            >
              <Text style={{ color: theme.colors.text }}>Close</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Rider Info Card */}
        <View style={[styles.riderCard, { 
          backgroundColor: theme.colors.card,
          ...theme.shadows.medium,
        }]}>
          <View style={styles.riderHeader}>
            <View style={[styles.riderAvatar, { backgroundColor: theme.colors.primary }]}>
              <User size={24} color="#FFFFFF" strokeWidth={2} />
            </View>
            <View style={styles.riderInfo}>
              <Text style={[styles.riderName, { color: theme.colors.text }]}>{rider.name}</Text>
              <View style={styles.riderRating}>
                <Star size={16} color="#FFC947" fill="#FFC947" strokeWidth={2} />
                <Text style={[styles.ratingText, { color: theme.colors.text }]}>{rider.rating}</Text>
              </View>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.messageButton, { backgroundColor: isDark ? '#1F2937' : '#F0F2FF' }]}
                onPress={handleMessage}
              >
                <MessageCircle size={20} color={isDark ? "#5A47FF" : "#5A47FF"} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.callButton, { backgroundColor: theme.colors.success }]} onPress={handleCall}>
                <Phone size={20} color="#FFFFFF" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.riderDetails}>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>{'Vehicle:'}</Text>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>{rider.vehicle}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>{'Plate:'}</Text>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>{rider.plateNumber}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>{'Location:'}</Text>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>{rider.currentLocation}</Text>
            </View>
          </View>
        </View>

        {/* Delivery Steps */}
        <View style={[styles.stepsContainer, { 
          backgroundColor: theme.colors.card,
          ...theme.shadows.medium,
        }]}>
          <Text style={[styles.stepsTitle, { color: theme.colors.text }]}>{'Delivery Progress'}</Text>

          {[
            { status: 'rider_assigned', text: 'Rider assigned to your delivery' },
            {
              status: 'pickup_arrived',
              text: 'Rider arrived at pickup location',
            },
            { status: 'picked_up', text: 'Package picked up' },
            { status: 'in_transit', text: 'Package in transit' },
            { status: 'nearby', text: 'Rider approaching destination' },
            { status: 'delivered', text: 'Package delivered' },
            { status: 'feedback_requested', text: 'Feedback requested' }, // New step 7
            { status: 'completed', text: 'Delivery completed' }, // New step 8
          ].map((step, index) => {
            const stepStatus = step.status as DeliveryStatus;
            const isCompleted =
              stepStatus === 'rider_assigned' ||
              stepStatus === 'pickup_arrived' ||
              stepStatus === 'picked_up' ||
              (stepStatus === 'in_transit' && deliveryStatus === 'in_transit') ||
              (stepStatus === 'delivered' && deliveryStatus === 'delivered') ||
              (stepStatus === 'feedback_requested' && deliveryStatus === 'completed') ||
              (stepStatus === 'completed' && deliveryStatus === 'completed');

            const isCurrent = stepStatus === deliveryStatus;

            return (
              <View key={stepStatus} style={styles.stepItem}>
                <View
                  style={[
                    styles.stepIndicator,
                    isCompleted && styles.completedStep,
                    isCurrent && styles.currentStep,
                    !isCompleted && { backgroundColor: isDark ? '#4B5563' : '#E5E7EB' }
                  ]}
                >
                  {isCompleted ? (
                    <Text style={styles.stepCheckmark}>✓</Text>
                  ) : (
                    <Text style={[styles.stepNumber, { color: isDark ? theme.colors.textSecondary : '#9CA3AF' }]}>{index + 1}</Text>
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
          })}
        </View>

        {/* Bottom Action */}
        {deliveryStatus === 'nearby' && (
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
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
    borderRadius: 12,
    padding: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  elapsedTime: {
    fontSize: 14,
    fontWeight: '600',
  },
  estimatedArrival: {
    fontSize: 14,
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
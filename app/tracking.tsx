import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
  Animated,
  PanResponder,
} from 'react-native';
import {
  ArrowLeft,
  MessageCircle,
  Phone,
  Navigation,
  Clock,
  Package,
  User,
  Star,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext'; // <-- Add this import

interface RiderInfo {
  name: string;
  rating: number;
  phone: string;
  vehicle: string;
  plateNumber: string;
  estimatedArrival: string;
  currentLocation: string;
}

type DeliveryStatus = 'rider_assigned' | 'pickup_arrived' | 'picked_up' | 'in_transit' | 'nearby' | 'delivered';

export default function TrackingScreen() {
  const { theme } = useTheme(); // <-- Get theme
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('in_transit');
  const [rider] = useState<RiderInfo>({
    name: 'Mike Johnson',
    rating: 4.8,
    phone: '+1 (555) 987-6543',
    vehicle: 'Honda CBR 150R',
    plateNumber: 'ABC-1234',
    estimatedArrival: '12 mins',
    currentLocation: 'Oak Street, heading to Main St',
  });

  const [elapsedTime, setElapsedTime] = useState(700); // 14 minutes in seconds

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
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
      default:
        return 'Processing';
    }
  };

  const getStatusColor = (status: DeliveryStatus) => {
    switch (status) {
      case 'rider_assigned':
        return theme.colors.warning;
      case 'pickup_arrived':
        return theme.colors.info;
      case 'picked_up':
        return theme.colors.accent;
      case 'in_transit':
        return theme.colors.primary;
      case 'nearby':
        return theme.colors.warning;
      case 'delivered':
        return theme.colors.success;
      default:
        return theme.colors.textTertiary;
    }
  };

  const handleCall = () => {
    Alert.alert(
      'Call Rider',
      'Choose how you want to call Mike',
      [
        {
          text: 'In-App Call',
          onPress: () => Alert.alert('In-App Call', 'Starting in-app call with Mike...'),
        },
        {
          text: 'Phone Call',
          onPress: () => Alert.alert('Phone Call', `Calling ${rider.phone}...`),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleMessage = () => {
    router.push('/chat');
  };

  const handleMarkDelivered = () => {
    Alert.alert(
      'Confirm Delivery',
      'Has your package been delivered?',
      [
        { text: 'No, Not Yet', style: 'cancel' },
        {
          text: 'Yes, Delivered',
          onPress: () => {
            setDeliveryStatus('delivered');
            Alert.alert('Delivery Confirmed', 'Thank you! Your delivery has been marked as completed.');
          },
        },
      ]
    );
  };

  // Floating status card position
  const pan = React.useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={theme.colors.primary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.primary }]}>Track Delivery</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Map Area Placeholder */}
        <View style={[styles.mapContainer, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.mapPlaceholder}>
            <Navigation size={48} color={theme.colors.primary} strokeWidth={2} />
            <Text style={[styles.mapText, { color: theme.colors.text } ]}>Live Map View</Text>
            <Text style={[styles.mapSubtext, { color: theme.colors.textSecondary }]}>
              Real-time rider location would be displayed here using Google Maps
            </Text>
          </View>

          {/* Floating Status Card */}
          <Animated.View
            style={[
              styles.statusCard,
              { backgroundColor: theme.colors.surface },
              theme.shadows.medium,
              { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
              { position: 'absolute', top: 20, left: 20, right: 20, zIndex: 10 },
            ]}
            {...panResponder.panHandlers}
          >
            <View style={styles.statusHeader}>
              <View style={styles.statusIndicator}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: getStatusColor(deliveryStatus) },
                  ]}
                />
                <Text style={[styles.statusText, { color: theme.colors.text }]}>{getStatusText(deliveryStatus)}</Text>
              </View>
              <Text style={[styles.elapsedTime, { color: theme.colors.primary }]}>{formatTime(elapsedTime)}</Text>
            </View>
            <Text style={[styles.estimatedArrival, { color: theme.colors.textSecondary }]}>
              Estimated arrival: {rider.estimatedArrival}
            </Text>
          </Animated.View>
        </View>

        {/* Rider Info Card */}
        <View style={[styles.riderCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
          <View style={styles.riderHeader}>
            <View style={[styles.riderAvatar, { backgroundColor: theme.colors.primary }]}>
              <User size={24} color={theme.colors.black} strokeWidth={2} />
            </View>
            <View style={styles.riderInfo}>
              <Text style={[styles.riderName, { color: theme.colors.text }]}>{rider.name}</Text>
              <View style={styles.riderRating}>
                <Star
                  size={16}
                  color={theme.colors.warning}
                  fill={theme.colors.warning}
                  strokeWidth={2}
                />
                <Text style={[styles.ratingText, { color: theme.colors.textSecondary }]}>{rider.rating}</Text>
              </View>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.messageButton, { backgroundColor: theme.colors.primary + '20' }]}
                onPress={handleMessage}
              >
                <MessageCircle size={20} color={theme.colors.primary} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.callButton, { backgroundColor: theme.colors.success }]} onPress={handleCall}>
                <Phone size={20} color={theme.colors.black} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.riderDetails}>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Vehicle:</Text>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>{rider.vehicle}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Plate:</Text>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>{rider.plateNumber}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Location:</Text>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>{rider.currentLocation}</Text>
            </View>
          </View>
        </View>

        {/* Delivery Steps */}
        <View style={[styles.stepsContainer, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
          <Text style={[styles.stepsTitle, { color: theme.colors.text }]}>Delivery Progress</Text>

          {[
            {
              status: 'rider_assigned',
              text: 'Rider assigned to your delivery',
            },
            {
              status: 'pickup_arrived',
              text: 'Rider arrived at pickup location',
            },
            { status: 'picked_up', text: 'Package picked up' },
            { status: 'in_transit', text: 'Package in transit' },
            { status: 'nearby', text: 'Rider approaching destination' },
            { status: 'delivered', text: 'Package delivered' },
          ].map((step, index) => {
            const stepStatus = step.status as DeliveryStatus;
            const isCompleted =
              stepStatus === 'rider_assigned' ||
              stepStatus === 'pickup_arrived' ||
              stepStatus === 'picked_up' ||
              (stepStatus === 'in_transit' &&
                deliveryStatus === 'in_transit') ||
              (stepStatus === 'delivered' && deliveryStatus === 'delivered');

            const isCurrent = stepStatus === deliveryStatus;

            return (
              <View key={stepStatus} style={styles.stepItem}>
                <View
                  style={[styles.stepIndicator, isCompleted && { backgroundColor: theme.colors.success }, isCurrent && { backgroundColor: theme.colors.primary }]}
                >
                  {isCompleted ? (
                    <Text style={[styles.stepCheckmark, { color: theme.colors.black }]}>✓</Text>
                  ) : (
                    <Text style={[styles.stepNumber, { color: theme.colors.textTertiary }]}>{index + 1}</Text>
                  )}
                </View>
                <Text
                  style={[styles.stepText, isCompleted && { color: theme.colors.textSecondary, fontWeight: '500' }, isCurrent && { color: theme.colors.text, fontWeight: '600' }]}
                >
                  {step.text}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Bottom Action */}
        {deliveryStatus === 'nearby' && (
          <View style={[styles.bottomContainer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
            <TouchableOpacity
              style={[styles.deliveredButton, { backgroundColor: theme.colors.success }]}
              onPress={handleMarkDelivered}
            >
              <Package size={20} color={theme.colors.success} strokeWidth={2} />
              <Text style={[styles.deliveredText, { color: theme.colors.success } ]}>Mark as Delivered</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: '#157AFF',
    marginTop: 20,
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
    backgroundColor: '#E5E7EB',
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
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  mapSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  statusCard: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
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
    color: '#1F2937',
  },
  elapsedTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5A47FF',
  },
  estimatedArrival: {
    fontSize: 14,
    color: '#6B7280',
  },
  riderCard: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
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
    backgroundColor: '#5A47FF',
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
    color: '#1F2937',
    marginBottom: 4,
  },
  riderRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
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
    backgroundColor: '#F0F2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
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
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  stepsContainer: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    marginTop: 0,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  stepsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
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
    backgroundColor: '#E5E7EB',
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
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  stepText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  completedStepText: {
    color: '#374151',
    fontWeight: '500',
  },
  currentStepText: {
    color: '#1F2937',
    fontWeight: '600',
  },
  bottomContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  deliveredButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveredText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});
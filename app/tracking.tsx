import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
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

  const [elapsedTime, setElapsedTime] = useState(540); // 14 minutes in seconds

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
        return '#FFC947';
      case 'pickup_arrived':
        return '#3B82F6';
      case 'picked_up':
        return '#8B5CF6';
      case 'in_transit':
        return '#5A47FF';
      case 'nearby':
        return '#F97316';
      case 'delivered':
        return '#10B981';
      default:
        return '#6B7280';
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.title}>Track Delivery</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Map Area Placeholder */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Navigation size={48} color="#5A47FF" strokeWidth={2} />
          <Text style={styles.mapText}>Live Map View</Text>
          <Text style={styles.mapSubtext}>
            Real-time rider location would be displayed here using Google Maps
          </Text>
        </View>
        
        {/* Floating Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusIndicator}>
              <View 
                style={[styles.statusDot, { backgroundColor: getStatusColor(deliveryStatus) }]} 
              />
              <Text style={styles.statusText}>{getStatusText(deliveryStatus)}</Text>
            </View>
            <Text style={styles.elapsedTime}>{formatTime(elapsedTime)}</Text>
          </View>
          <Text style={styles.estimatedArrival}>
            Estimated arrival: {rider.estimatedArrival}
          </Text>
        </View>
      </View>

      {/* Rider Info Card */}
      <View style={styles.riderCard}>
        <View style={styles.riderHeader}>
          <View style={styles.riderAvatar}>
            <User size={24} color="#FFFFFF" strokeWidth={2} />
          </View>
          <View style={styles.riderInfo}>
            <Text style={styles.riderName}>{rider.name}</Text>
            <View style={styles.riderRating}>
              <Star size={16} color="#FFC947" fill="#FFC947" strokeWidth={2} />
              <Text style={styles.ratingText}>{rider.rating}</Text>
            </View>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
              <MessageCircle size={20} color="#5A47FF" strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.callButton} onPress={handleCall}>
              <Phone size={20} color="#FFFFFF" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.riderDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Vehicle:</Text>
            <Text style={styles.detailValue}>{rider.vehicle}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Plate:</Text>
            <Text style={styles.detailValue}>{rider.plateNumber}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Location:</Text>
            <Text style={styles.detailValue}>{rider.currentLocation}</Text>
          </View>
        </View>
      </View>

      {/* Delivery Steps */}
      <View style={styles.stepsContainer}>
        <Text style={styles.stepsTitle}>Delivery Progress</Text>
        
        {[
          { status: 'rider_assigned', text: 'Rider assigned to your delivery' },
          { status: 'pickup_arrived', text: 'Rider arrived at pickup location' },
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
            (stepStatus === 'in_transit' && deliveryStatus === 'in_transit') ||
            (stepStatus === 'delivered' && deliveryStatus === 'delivered');
          
          const isCurrent = stepStatus === deliveryStatus;
          
          return (
            <View key={stepStatus} style={styles.stepItem}>
              <View style={[
                styles.stepIndicator,
                isCompleted && styles.completedStep,
                isCurrent && styles.currentStep,
              ]}>
                {isCompleted ? (
                  <Text style={styles.stepCheckmark}>✓</Text>
                ) : (
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                )}
              </View>
              <Text style={[
                styles.stepText,
                isCompleted && styles.completedStepText,
                isCurrent && styles.currentStepText,
              ]}>
                {step.text}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Bottom Action */}
      {deliveryStatus === 'nearby' && (
        <View style={styles.bottomContainer}>
          <TouchableOpacity style={styles.deliveredButton} onPress={handleMarkDelivered}>
            <Package size={20} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.deliveredText}>Mark as Delivered</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#5A47FF',
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
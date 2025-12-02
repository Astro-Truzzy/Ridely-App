import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  CheckCircle,
  CreditCard,
  Wallet,
  DollarSign,
  MapPin,
  Clock,
  Package,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useAuth } from '@/contexts/AuthContext';

interface PaymentMethod {
  id: string;
  type: 'card' | 'cash' | 'wallet';
  label: string;
  details: string;
  icon: any;
}

export default function ConfirmationScreen() {
  const {
    size,
    pickupAddress,
    dropoffAddress,
    deliveryTime,
    scheduledTime,
    price,
    distance,
    pickupLat,
    pickupLon,
    dropoffLat,
    dropoffLon,
  } = useLocalSearchParams<{
    size: string;
    pickupAddress: string;
    dropoffAddress: string;
    deliveryTime: string;
    scheduledTime?: string;
    price: string;
    distance: string;
    pickupLat?: string;
    pickupLon?: string;
    dropoffLat?: string;
    dropoffLon?: string;
  }>();

  const { createDelivery } = useDeliveries();
  const { user } = useAuth();
  const [selectedPayment, setSelectedPayment] = useState<string>('card1');
  const [isBooking, setIsBooking] = useState(false);

  const paymentMethods: PaymentMethod[] = [
    {
      id: 'card1',
      type: 'card',
      label: 'Credit Card',
      details: '**** **** **** 4242',
      icon: CreditCard,
    },
    {
      id: 'cash',
      type: 'cash',
      label: 'Cash on Delivery',
      details: 'Pay the rider directly',
      icon: DollarSign,
    },
    {
      id: 'wallet',
      type: 'wallet',
      label: 'Ridely Wallet',
      details: 'Balance: $45.20',
      icon: Wallet,
    },
  ];

  const handleBooking = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a booking');
      return;
    }

    setIsBooking(true);
    
    try {
      // Create delivery in database
      const deliveryData = {
        pickup_address: pickupAddress,
        dropoff_address: dropoffAddress,
        parcel_size: size as 'small' | 'medium' | 'large',
        total_cost: parseFloat(price),
        distance: parseFloat(distance),
        estimated_time: '25-35 mins', // This could be calculated from route
        delivery_time: (deliveryTime as 'now' | 'scheduled'),
        scheduled_time: deliveryTime === 'scheduled' && scheduledTime ? scheduledTime : null,
      };

      const newDelivery = await createDelivery(deliveryData);
      
      setIsBooking(false);
      
      Alert.alert(
        'Booking Confirmed! 🎉',
        'Your delivery has been booked successfully. You will receive a notification when a rider accepts your request.',
        [
          {
            text: 'View Bookings',
            onPress: () => {
              router.replace('/(tabs)/bookings');
            },
          },
          {
            text: 'Go to Home',
            onPress: () => {
              router.replace('/(tabs)');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error creating delivery:', error);
      setIsBooking(false);
      Alert.alert(
        'Booking Failed',
        error?.message || 'Failed to create booking. Please try again.'
      );
    }
  };

  const getSizeLabel = (size: string) => {
    switch (size) {
      case 'small':
        return 'Small Package';
      case 'medium':
        return 'Medium Package';
      case 'large':
        return 'Large Package';
      default:
        return 'Package';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1F2937" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.title}>Confirm Booking</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressStep, styles.completedStep]} />
            <View style={[styles.progressStep, styles.completedStep]} />
            <View style={[styles.progressStep, styles.completedStep]} />
            <View style={[styles.progressStep, styles.activeStep]} />
          </View>
          <Text style={styles.progressText}>Step 4 of 4</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <CheckCircle size={32} color="#10B981" strokeWidth={2} />
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryTitle}>Almost Done!</Text>
                <Text style={styles.summarySubtitle}>Review and confirm your booking</Text>
              </View>
              <Text style={styles.totalPrice}>₦{parseFloat(price || '0').toLocaleString('en-NG')}</Text>
            </View>
          </View>

          {/* Booking Details */}
          <View style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Booking Summary</Text>
            
            <View style={styles.detailRow}>
              <Package size={20} color="#5A47FF" strokeWidth={2} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Package Size</Text>
                <Text style={styles.detailValue}>{getSizeLabel(size)}</Text>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <MapPin size={20} color="#10B981" strokeWidth={2} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Pickup</Text>
                <Text style={styles.detailValue} numberOfLines={2}>{pickupAddress}</Text>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <MapPin size={20} color="#EF4444" strokeWidth={2} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Dropoff</Text>
                <Text style={styles.detailValue} numberOfLines={2}>{dropoffAddress}</Text>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <Clock size={20} color="#FFC947" strokeWidth={2} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Delivery Time</Text>
                <Text style={styles.detailValue}>
                  {deliveryTime === 'now' 
                    ? 'Immediate Pickup' 
                    : `Scheduled: ${scheduledTime || 'Later'}`}
                </Text>
              </View>
            </View>
            
            <View style={styles.estimateRow}>
              <Text style={styles.estimateText}>
                📍 Distance: {distance} km • ⏱️ Est. delivery: 25-35 mins
              </Text>
            </View>
          </View>

          {/* Payment Method */}
          <View style={styles.paymentCard}>
            <Text style={styles.cardTitle}>Payment Method</Text>
            
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.paymentOption,
                  selectedPayment === method.id && styles.selectedPayment,
                ]}
                onPress={() => setSelectedPayment(method.id)}>
                <View style={styles.paymentIcon}>
                  <method.icon size={24} color="#5A47FF" strokeWidth={2} />
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentLabel}>{method.label}</Text>
                  <Text style={styles.paymentDetails}>{method.details}</Text>
                </View>
                {selectedPayment === method.id && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Terms */}
          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By confirming this booking, you agree to our{' '}
              <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>. The rider will arrive
              within the estimated time frame.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.bookingButton, isBooking && styles.bookingButtonDisabled]}
          onPress={handleBooking}
          disabled={isBooking}>
          <Text style={styles.bookingText}>
            {isBooking ? 'Confirming Booking...' : `Confirm & Pay ₦${parseFloat(price || '0').toLocaleString('en-NG')}`}
          </Text>
        </TouchableOpacity>
      </View>
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressStep: {
    width: 60,
    height: 4,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
    borderRadius: 2,
  },
  activeStep: {
    backgroundColor: '#5A47FF',
  },
  completedStep: {
    backgroundColor: '#10B981',
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: 20,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryInfo: {
    flex: 1,
    marginLeft: 16,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  totalPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: '#10B981',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailInfo: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  estimateRow: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  estimateText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  selectedPayment: {
    borderColor: '#5A47FF',
    backgroundColor: '#F8F9FF',
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  paymentDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#5A47FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  termsContainer: {
    marginBottom: 32,
  },
  termsText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
    textAlign: 'center',
  },
  termsLink: {
    color: '#5A47FF',
    fontWeight: '500',
  },
  bottomContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bookingButton: {
    backgroundColor: '#5A47FF',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  bookingButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  bookingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
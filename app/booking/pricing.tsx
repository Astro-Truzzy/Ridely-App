import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowLeft,
  DollarSign,
  MapPin,
  Clock,
  Package,
  ChevronRight,
  Truck,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';

interface PricingBreakdown {
  basePrice: number;
  distance: number;
  sizeSurcharge: number;
  timeSurcharge?: number;
  total: number;
}

export default function PricingScreen() {
  const {
    size,
    pickupAddress,
    dropoffAddress,
    deliveryTime,
    scheduledTime,
  } = useLocalSearchParams<{
    size: string;
    pickupAddress: string;
    dropoffAddress: string;
    deliveryTime: string;
    scheduledTime?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState<PricingBreakdown | null>(null);
  const [estimatedTime, setEstimatedTime] = useState('25-35 mins');

  // Simulate Google Maps API pricing calculation
  useEffect(() => {
    const calculatePrice = async () => {
      setLoading(true);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock calculation based on distance and size
      const baseDistance = Math.random() * 10 + 5; // 5-15 km
      const basePrice = 8 + (baseDistance * 0.8); // Base pricing formula
      
      let sizeSurcharge = 0;
      if (size === 'medium') {
        sizeSurcharge = basePrice * 0.02; // 2% surcharge
      } else if (size === 'large') {
        sizeSurcharge = basePrice * 0.05; // 5% surcharge
      }
      
      const timeSurcharge = deliveryTime === 'scheduled' ? 2.5 : 0;
      const total = basePrice + sizeSurcharge + timeSurcharge;
      
      setPricing({
        basePrice: Number(basePrice.toFixed(2)),
        distance: Number(baseDistance.toFixed(1)),
        sizeSurcharge: Number(sizeSurcharge.toFixed(2)),
        timeSurcharge: timeSurcharge,
        total: Number(total.toFixed(2)),
      });
      
      setLoading(false);
    };

    calculatePrice();
  }, [size, deliveryTime]);

  const handleConfirmBooking = () => {
    if (pricing) {
      router.push({
        pathname: '/booking/confirmation',
        params: {
          size,
          pickupAddress,
          dropoffAddress,
          deliveryTime,
          scheduledTime,
          price: pricing.total.toString(),
          distance: pricing.distance.toString(),
        },
      });
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
        <Text style={styles.title}>Price Estimate</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressStep, styles.completedStep]} />
            <View style={[styles.progressStep, styles.completedStep]} />
            <View style={[styles.progressStep, styles.activeStep]} />
            <View style={styles.progressStep} />
          </View>
          <Text style={styles.progressText}>Step 3 of 4</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#5A47FF" />
              <Text style={styles.loadingText}>Calculating best price...</Text>
              <Text style={styles.loadingSubtext}>
                Using Google Maps to find the optimal route
              </Text>
            </View>
          ) : (
            <>
              {/* Price Card */}
              <View style={styles.priceCard}>
                <View style={styles.priceHeader}>
                  <DollarSign size={32} color="#5A47FF" strokeWidth={2} />
                  <View style={styles.priceInfo}>
                    <Text style={styles.totalPrice}>${pricing?.total}</Text>
                    <Text style={styles.priceLabel}>Total Cost</Text>
                  </View>
                  <View style={styles.estimatedTime}>
                    <Clock size={20} color="#10B981" strokeWidth={2} />
                    <Text style={styles.timeText}>{estimatedTime}</Text>
                  </View>
                </View>
              </View>

              {/* Delivery Details */}
              <View style={styles.detailsCard}>
                <Text style={styles.cardTitle}>Delivery Details</Text>
                
                <View style={styles.detailItem}>
                  <Package size={20} color="#5A47FF" strokeWidth={2} />
                  <Text style={styles.detailText}>{getSizeLabel(size)}</Text>
                </View>
                
                <View style={styles.detailItem}>
                  <MapPin size={20} color="#10B981" strokeWidth={2} />
                  <Text style={styles.detailText} numberOfLines={2}>
                    From: {pickupAddress}
                  </Text>
                </View>
                
                <View style={styles.detailItem}>
                  <MapPin size={20} color="#EF4444" strokeWidth={2} />
                  <Text style={styles.detailText} numberOfLines={2}>
                    To: {dropoffAddress}
                  </Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Truck size={20} color="#6B7280" strokeWidth={2} />
                  <Text style={styles.detailText}>
                    Distance: {pricing?.distance} km
                  </Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Clock size={20} color="#FFC947" strokeWidth={2} />
                  <Text style={styles.detailText}>
                    {deliveryTime === 'now' 
                      ? 'Immediate Pickup' 
                      : `Scheduled: ${scheduledTime || 'Later'}`}
                  </Text>
                </View>
              </View>

              {/* Price Breakdown */}
              <View style={styles.breakdownCard}>
                <Text style={styles.cardTitle}>Price Breakdown</Text>
                
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Base delivery fee</Text>
                  <Text style={styles.breakdownValue}>${pricing?.basePrice}</Text>
                </View>
                
                {pricing?.sizeSurcharge ? (
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>
                      Size surcharge ({size === 'medium' ? '2%' : '5%'})
                    </Text>
                    <Text style={styles.breakdownValue}>+${pricing.sizeSurcharge}</Text>
                  </View>
                ) : null}
                
                {pricing?.timeSurcharge ? (
                  <View style={styles.breakdownItem}>
                    <Text style={styles.breakdownLabel}>Scheduling fee</Text>
                    <Text style={styles.breakdownValue}>+${pricing.timeSurcharge}</Text>
                  </View>
                ) : null}
                
                <View style={styles.breakdownDivider} />
                
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownTotal}>Total</Text>
                  <Text style={styles.breakdownTotalValue}>${pricing?.total}</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Bottom Button */}
      {!loading && (
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirmBooking}>
            <Text style={styles.confirmText}>Confirm Booking</Text>
            <ChevronRight size={20} color="#FFFFFF" strokeWidth={2} />
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
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  priceCard: {
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
    borderColor: '#5A47FF',
  },
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceInfo: {
    flex: 1,
    alignItems: 'center',
  },
  totalPrice: {
    fontSize: 36,
    fontWeight: '700',
    color: '#5A47FF',
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  estimatedTime: {
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 4,
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
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  breakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  breakdownTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  breakdownTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5A47FF',
  },
  bottomContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  confirmButton: {
    flexDirection: 'row',
    backgroundColor: '#5A47FF',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
});
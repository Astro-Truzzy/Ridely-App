import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';
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
import { fetchGoogleDirections } from '@/lib/googleDirections';
import { PRICE_PER_KM, estimateRoadDistanceKm } from '@/lib/pricing';

interface PricingBreakdown {
  basePrice: number;
  distance: number;
  sizeSurcharge: number;
  timeSurcharge?: number;
  total: number;
}

export default function PricingScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const {
    size,
    pickupAddress,
    dropoffAddress,
    pickupLat,
    pickupLon,
    dropoffLat,
    dropoffLon,
    deliveryTime,
    scheduledTime,
  } = useLocalSearchParams<{
    size: string;
    pickupAddress: string;
    dropoffAddress: string;
    pickupLat?: string;
    pickupLon?: string;
    dropoffLat?: string;
    dropoffLon?: string;
    deliveryTime: string;
    scheduledTime?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState<PricingBreakdown | null>(null);
  const [estimatedTime, setEstimatedTime] = useState('25-35 mins');

  // Calculate road distance using Google Directions API
  const calculateRoadDistance = async (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): Promise<{ distance: number; duration: number }> => {
    const result = await fetchGoogleDirections(lat1, lon1, lat2, lon2);
    if (result) {
      const minutes = Math.round(result.durationSeconds / 60);
      setEstimatedTime(`${minutes}-${minutes + 10} mins`);
      return {
        distance: result.distanceKm,
        duration: result.durationSeconds,
      };
    }

    // Fallback: Haversine + road factor (must match server fare rules)
    console.warn('Using estimated distance (Google Directions API unavailable).');
    setEstimatedTime('25-35 mins');
    return {
      distance: estimateRoadDistanceKm(lat1, lon1, lat2, lon2),
      duration: 0,
    };
  };

  // Calculate pricing based on road distance
  useEffect(() => {
    const calculatePrice = async () => {
      setLoading(true);
      
      // Check if we have valid coordinates
      if (!pickupLat || !pickupLon || !dropoffLat || !dropoffLon) {
        // Fallback if coordinates are missing
        setPricing({
          basePrice: 0,
          distance: 0,
          sizeSurcharge: 0,
          timeSurcharge: 0,
          total: 0,
        });
        setLoading(false);
        return;
      }

      try {
        // Calculate actual road distance in kilometers
        const { distance: distanceKm } = await calculateRoadDistance(
          parseFloat(pickupLat),
          parseFloat(pickupLon),
          parseFloat(dropoffLat),
          parseFloat(dropoffLon)
        );

        const basePrice = distanceKm * PRICE_PER_KM;
        
        // No surcharges, just distance-based pricing
        const total = basePrice;
        
        setPricing({
          basePrice: Number(basePrice.toFixed(2)),
          distance: Number(distanceKm.toFixed(2)),
          sizeSurcharge: 0,
          timeSurcharge: 0,
          total: Number(total.toFixed(2)),
        });
      } catch (error) {
        console.error('Error calculating price:', error);
        // Fallback pricing
        setPricing({
          basePrice: 0,
          distance: 0,
          sizeSurcharge: 0,
          timeSurcharge: 0,
          total: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    calculatePrice();
  }, [pickupLat, pickupLon, dropoffLat, dropoffLon]);

  const handleConfirmBooking = () => {
    if (pricing) {
      router.push({
        pathname: '/booking/confirmation',
        params: {
          size,
          pickupAddress,
          dropoffAddress,
          pickupLat: pickupLat || '',
          pickupLon: pickupLon || '',
          dropoffLat: dropoffLat || '',
          dropoffLon: dropoffLon || '',
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
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Header */}
      <View style={[styles.header, {
        backgroundColor: theme.colors.card,
        borderBottomColor: theme.colors.border,
        paddingTop: 16 + insets.top,
      }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.colors.surface }]}
          onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Price Estimate</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressStep, { backgroundColor: theme.colors.success }]} />
            <View style={[styles.progressStep, { backgroundColor: theme.colors.success }]} />
            <View style={[styles.progressStep, { backgroundColor: theme.colors.primary }]} />
            <View style={[styles.progressStep, { backgroundColor: theme.colors.border }]} />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>Step 3 of 4</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.text }]}>Calculating best price...</Text>
              <Text style={[styles.loadingSubtext, { color: theme.colors.textSecondary }]}>
                Calculating route distance using road network
              </Text>
            </View>
          ) : (
            <>
              {/* Price Card */}
              <View style={[
                styles.priceCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.primary,
                },
                theme.shadows.large,
              ]}>
                <View style={styles.priceHeader}>
                  <DollarSign size={32} color={theme.colors.primary} strokeWidth={2} />
                  <View style={styles.priceInfo}>
                    <Text style={[styles.totalPrice, { color: theme.colors.primary }]}>
                      ₦{pricing?.total ? pricing.total.toLocaleString('en-NG') : '0'}
                    </Text>
                    <Text style={[styles.priceLabel, { color: theme.colors.textSecondary }]}>Total Cost</Text>
                  </View>
                  <View style={styles.estimatedTime}>
                    <Clock size={20} color={theme.colors.success} strokeWidth={2} />
                    <Text style={[styles.timeText, { color: theme.colors.success }]}>{estimatedTime}</Text>
                  </View>
                </View>
              </View>

              {/* Delivery Details */}
              <View style={[
                styles.detailsCard,
                { backgroundColor: theme.colors.card },
                theme.shadows.medium,
              ]}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Delivery Details</Text>
                
                <View style={styles.detailItem}>
                  <Package size={20} color={theme.colors.primary} strokeWidth={2} />
                  <Text style={[styles.detailText, { color: theme.colors.text }]}>{getSizeLabel(size)}</Text>
                </View>
                
                <View style={styles.detailItem}>
                  <MapPin size={20} color={theme.colors.success} strokeWidth={2} />
                  <Text style={[styles.detailText, { color: theme.colors.text }]} numberOfLines={2}>
                    From: {pickupAddress}
                  </Text>
                </View>
                
                <View style={styles.detailItem}>
                  <MapPin size={20} color={theme.colors.error} strokeWidth={2} />
                  <Text style={[styles.detailText, { color: theme.colors.text }]} numberOfLines={2}>
                    To: {dropoffAddress}
                  </Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Truck size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                  <Text style={[styles.detailText, { color: theme.colors.text }]}>
                    Distance: {pricing?.distance ? pricing.distance.toFixed(2) : '0.00'} km
                  </Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Clock size={20} color={theme.colors.warning} strokeWidth={2} />
                  <Text style={[styles.detailText, { color: theme.colors.text }]}>
                    {deliveryTime === 'now' 
                      ? 'Immediate Pickup' 
                      : `Scheduled: ${scheduledTime || 'Later'}`}
                  </Text>
                </View>
              </View>

              {/* Price Breakdown */}
              <View style={[
                styles.breakdownCard,
                { backgroundColor: theme.colors.card },
                theme.shadows.medium,
              ]}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Price Breakdown</Text>
                
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownLabel, { color: theme.colors.textSecondary }]}>
                    Delivery fee ({pricing?.distance ? pricing.distance.toFixed(2) : '0.00'} km × ₦{PRICE_PER_KM})
                  </Text>
                  <Text style={[styles.breakdownValue, { color: theme.colors.text }]}>
                    ₦{pricing?.basePrice ? pricing.basePrice.toLocaleString('en-NG') : '0'}
                  </Text>
                </View>
                
                <View style={[styles.breakdownDivider, { backgroundColor: theme.colors.border }]} />
                
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownTotal, { color: theme.colors.text }]}>Total</Text>
                  <Text style={[styles.breakdownTotalValue, { color: theme.colors.primary }]}>
                    ₦{pricing?.total ? pricing.total.toLocaleString('en-NG') : '0'}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Bottom Button */}
      {!loading && (
        <View style={[styles.bottomContainer, {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
        }]}>
          <TouchableOpacity
            style={[styles.confirmButton, { backgroundColor: theme.colors.primary }]}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    marginHorizontal: 4,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
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
    marginTop: 16,
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  priceCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 2,
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
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  estimatedTime: {
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  detailsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  breakdownCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  breakdownDivider: {
    height: 1,
    marginVertical: 12,
  },
  breakdownTotal: {
    fontSize: 16,
    fontWeight: '700',
  },
  breakdownTotalValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  bottomContainer: {
    padding: 20,
    borderTopWidth: 1,
  },
  confirmButton: {
    flexDirection: 'row',
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
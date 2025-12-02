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

  // Calculate road distance using Mapbox Directions API (very accurate, as accurate as Google Maps)
  const calculateRoadDistance = async (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): Promise<{ distance: number; duration: number }> => {
    const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

    // Use Mapbox Directions API for accurate road distance calculation
    if (mapboxToken) {
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

        if (response.ok) {
          const data = await response.json();
          
          if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const distanceMeters = route.distance;
            const durationSeconds = route.duration;
            
            const distanceKm = distanceMeters / 1000;
            const minutes = Math.round(durationSeconds / 60);
            setEstimatedTime(`${minutes}-${minutes + 10} mins`);
            
            return {
              distance: distanceKm,
              duration: durationSeconds,
            };
          }
        }
      } catch (error) {
        console.error('Mapbox API error:', error);
      }
    } else {
      console.warn('Mapbox access token not found. Please add EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env file');
    }

    // Fallback: Haversine formula with buffer if Mapbox fails or token is missing
    console.warn('Using estimated distance (Mapbox API unavailable). Please configure EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN for accurate calculations.');
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightLineDistance = R * c;
    
    // Add 40% buffer for road distance approximation
    const estimatedRoadDistance = straightLineDistance * 1.4;
    setEstimatedTime('25-35 mins');
    
    return {
      distance: estimatedRoadDistance,
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

        // Calculate price: 250 naira per kilometer
        const PRICE_PER_KM = 250;
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
                Calculating route distance using road network
              </Text>
            </View>
          ) : (
            <>
              {/* Price Card */}
              <View style={styles.priceCard}>
                <View style={styles.priceHeader}>
                  <DollarSign size={32} color="#5A47FF" strokeWidth={2} />
                  <View style={styles.priceInfo}>
                    <Text style={styles.totalPrice}>₦{pricing?.total ? pricing.total.toLocaleString('en-NG') : '0'}</Text>
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
                    Distance: {pricing?.distance ? pricing.distance.toFixed(2) : '0.00'} km
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
                  <Text style={styles.breakdownLabel}>Delivery fee ({pricing?.distance ? pricing.distance.toFixed(2) : '0.00'} km × ₦250)</Text>
                  <Text style={styles.breakdownValue}>₦{pricing?.basePrice ? pricing.basePrice.toLocaleString('en-NG') : '0'}</Text>
                </View>
                
                <View style={styles.breakdownDivider} />
                
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownTotal}>Total</Text>
                  <Text style={styles.breakdownTotalValue}>₦{pricing?.total ? pricing.total.toLocaleString('en-NG') : '0'}</Text>
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
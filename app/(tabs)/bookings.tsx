import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Package, Clock, CheckCircle, XCircle, MapPin, X, Star, RotateCcw } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useDeliveryRatings } from '@/hooks/useDeliveryRatings';
import { geocodeAddress } from '@/lib/googleDirections';
import { CardSkeletonList } from '@/components/Skeleton';
import { tapLight, notifyWarning, notifySuccess, notifyError } from '@/lib/haptics';
import {
  mapCustomerBookingStatus,
  canCustomerCancelDelivery,
} from '@/lib/screenContracts';

interface Booking {
  id: string;
  deliveryId: string;
  riderId: string | null;
  date: string;
  time: string;
  from: string;
  to: string;
  status: 'delivered' | 'in_transit' | 'pending' | 'cancelled';
  price: string;
  riderName?: string;
  parcelSize: 'small' | 'medium' | 'large';
}

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { showAlert, showToast } = useAlert();
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [rateModalBooking, setRateModalBooking] = useState<Booking | null>(null);
  const [rateStars, setRateStars] = useState(0);
  const [rateReviewText, setRateReviewText] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const { deliveries, loading, updateDeliveryStatus, refetch } = useDeliveries();
  const { hasRated, getRatingForDelivery, submitRating, refetch: refetchRatings } = useDeliveryRatings();

  // Helper function to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Helper function to format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  // Map delivery status to booking status
  const mapDeliveryStatus = mapCustomerBookingStatus;

  // Convert deliveries to bookings format
  const bookings: Booking[] = deliveries.map((delivery) => ({
    id: delivery.id.substring(0, 8).toUpperCase(),
    deliveryId: delivery.id,
    riderId: delivery.rider_id ?? null,
    date: formatDate(delivery.created_at),
    time: formatTime(delivery.created_at),
    from: delivery.pickup_address,
    to: delivery.dropoff_address,
    status: mapDeliveryStatus(delivery.status),
    price: `₦${delivery.total_cost.toLocaleString('en-NG')}`,
    riderName: delivery.rider_id ? undefined : undefined,
    parcelSize: delivery.parcel_size,
  }));

  const handleCancelDelivery = (booking: Booking) => {
    showAlert(
      'Cancel delivery',
      'Are you sure you want to cancel this delivery? This cannot be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel delivery',
          style: 'destructive',
          onPress: async () => {
            notifyWarning();
            setCancellingId(booking.deliveryId);
            try {
              await updateDeliveryStatus(booking.deliveryId, 'cancelled');
              await refetch();
              notifySuccess();
            } catch (e) {
              notifyError();
              showToast('Could not cancel delivery. Please try again.', 'error');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const handleRebook = async (booking: Booking) => {
    const delivery = deliveries.find((d) => d.id === booking.deliveryId);
    let pickupLat = delivery?.pickup_lat;
    let pickupLng = delivery?.pickup_lng;
    let dropoffLat = delivery?.dropoff_lat;
    let dropoffLng = delivery?.dropoff_lng;

    if (pickupLat == null || pickupLng == null) {
      const coords = await geocodeAddress(booking.from);
      if (coords) {
        pickupLat = coords.latitude;
        pickupLng = coords.longitude;
      }
    }
    if (dropoffLat == null || dropoffLng == null) {
      const coords = await geocodeAddress(booking.to);
      if (coords) {
        dropoffLat = coords.latitude;
        dropoffLng = coords.longitude;
      }
    }

    router.push({
      pathname: '/booking/address',
      params: {
        size: booking.parcelSize,
        rebookPickup: booking.from,
        rebookDropoff: booking.to,
        ...(pickupLat != null && pickupLng != null
          ? { pickupLat: String(pickupLat), pickupLon: String(pickupLng) }
          : {}),
        ...(dropoffLat != null && dropoffLng != null
          ? { dropoffLat: String(dropoffLat), dropoffLon: String(dropoffLng) }
          : {}),
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return '#10B981';
      case 'in_transit':
        return '#5A47FF';
      case 'pending':
        return '#FFC947';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    const iconProps = {
      size: 12,
      strokeWidth: 2,
    };

    switch (status) {
      case 'delivered':
        return <CheckCircle {...iconProps} color={getStatusColor(status)} />;
      case 'in_transit':
        return <Clock {...iconProps} color={getStatusColor(status)} />;
      case 'cancelled':
        return <XCircle {...iconProps} color={getStatusColor(status)} />;
      default:
        return <Clock {...iconProps} color={getStatusColor(status)} />;
    }
  };

  const getFilteredBookings = () => {
    if (activeTab === 'active') {
      return bookings.filter(booking => 
        booking.status === 'in_transit' || booking.status === 'pending'
      );
    }
    
    if (activeTab === 'completed') {
      return bookings.filter(booking => 
        booking.status === 'delivered'
      );
    }
    
    if (activeTab === 'cancelled') {
      return bookings.filter(booking => 
        booking.status === 'cancelled'
      );
    }
    
    return bookings;
  };

  // Show loading state (using inline styles since styles is defined later)
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['left', 'right']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: 16 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>Bookings</Text>
        </View>
        <View style={{ paddingHorizontal: 20 }}>
          <CardSkeletonList count={4} />
        </View>
      </SafeAreaView>
    );
  }

  const onGestureEvent = (event: any) => {
    // Handle horizontal swipe gesture
    if (event.nativeEvent.state === State.END) {
      // Check if it's a right-to-left swipe (go back)
      if (event.nativeEvent.velocityX < -500) {
        router.back();
      }
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
    },
    newBookingButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    newBookingText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    tabContainer: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      marginBottom: 20,
      marginTop: 20,
      backgroundColor: theme.colors.surface,
      marginHorizontal: 20,
      borderRadius: 12,
      padding: 4,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    activeTab: {
      borderBottomColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.textTertiary,
    },
    activeTabText: {
      fontWeight: '600',
      color: theme.colors.text,
    },
    scrollView: {
      flex: 1,
      paddingHorizontal: 20,
    },
    bookingCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      ...theme.shadows.medium,
    },
    bookingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    bookingInfo: {
      flex: 1,
    },
    bookingId: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    bookingDateTime: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '600',
      marginLeft: 4,
      color: theme.colors.text,
    },
    addressContainer: {
      marginBottom: 16,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    addressText: {
      fontSize: 14,
      color: theme.colors.text,
      marginLeft: 12,
      flex: 1,
    },
    addressDivider: {
      width: 2,
      height: 20,
      backgroundColor: theme.colors.textTertiary,
      marginLeft: 8,
      marginBottom: 8,
      opacity: 0.5,
    },
    bookingFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    bookingDetails: {
      flex: 1,
    },
    parcelSize: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 2,
    },
    riderName: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '500',
    },
    price: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    actionContainer: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.textTertiary,
      opacity: 0.3,
    },
    trackText: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '600',
      textAlign: 'center',
    },
    cancelButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1.5,
      gap: 8,
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyStateTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyStateText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      paddingHorizontal: 40,
    },
    emptyStateButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 25,
    },
    emptyStateButtonText: {
      color: theme.colors.surface,
      fontSize: 16,
      fontWeight: '600',
    },
    rateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      gap: 8,
    },
    rateButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    ratedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      gap: 6,
    },
    ratedText: {
      fontSize: 14,
    },
    rebookButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      gap: 8,
      borderWidth: 1.5,
    },
    rebookButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    rateModalCard: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 20,
      padding: 24,
    },
    rateModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    rateModalTitle: {
      fontSize: 20,
      fontWeight: '700',
    },
    rateModalClose: {
      padding: 4,
    },
    rateModalSubtitle: {
      fontSize: 14,
      marginBottom: 20,
    },
    starsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 20,
    },
    starButton: {
      padding: 4,
    },
    reviewInput: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 14,
      minHeight: 80,
      textAlignVertical: 'top',
      marginBottom: 20,
    },
    rateSubmitButton: {
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    rateSubmitButtonDisabled: {
      opacity: 0.6,
    },
    rateSubmitButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PanGestureHandler
        onHandlerStateChange={onGestureEvent}
        activeOffsetX={[-20, 20]}
        failOffsetY={[-15, 15]}
      >
        <SafeAreaView style={styles.container} edges={['left', 'right']}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.colors.card, paddingTop: 20 + insets.top }]}>
            <Text style={[styles.title, { color: theme.colors.text }]}>My Bookings</Text>
            <TouchableOpacity
              style={[styles.newBookingButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => router.push('/booking')}>
              <Text style={styles.newBookingText}>New Booking</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={[styles.tabContainer, { backgroundColor: theme.colors.card }]}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'all' && styles.activeTab,
                { borderColor: activeTab === 'all' ? theme.colors.primary : 'transparent' }
              ]}
              onPress={() => setActiveTab('all')}>
              <Text style={[
                styles.tabText,
                { color: activeTab === 'all' ? theme.colors.primary : theme.colors.textSecondary }
              ]}>
                All
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'active' && styles.activeTab,
                { borderColor: activeTab === 'active' ? theme.colors.primary : 'transparent' }
              ]}
              onPress={() => setActiveTab('active')}>
              <Text style={[
                styles.tabText,
                { color: activeTab === 'active' ? theme.colors.primary : theme.colors.textSecondary }
              ]}>
                Active
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'completed' && styles.activeTab,
                { borderColor: activeTab === 'completed' ? theme.colors.primary : 'transparent' }
              ]}
              onPress={() => setActiveTab('completed')}>
              <Text style={[
                styles.tabText,
                { color: activeTab === 'completed' ? theme.colors.primary : theme.colors.textSecondary }
              ]}>
                Completed
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'cancelled' && styles.activeTab,
                { borderColor: activeTab === 'cancelled' ? theme.colors.primary : 'transparent' }
              ]}
              onPress={() => setActiveTab('cancelled')}>
              <Text style={[
                styles.tabText,
                { color: activeTab === 'cancelled' ? theme.colors.primary : theme.colors.textSecondary }
              ]}>
                Cancelled
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bookings List */}
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {getFilteredBookings().map(booking => (
              <TouchableOpacity
                key={booking.deliveryId}
                style={styles.bookingCard}
                onPress={() => {
                  if (booking.status === 'in_transit' || booking.status === 'pending') {
                    router.push({
                      pathname: '/tracking',
                      params: { deliveryId: booking.deliveryId },
                    });
                  }
                }}>
                <View style={styles.bookingHeader}>
                  <View style={styles.bookingInfo}>
                    <Text style={styles.bookingId}>#{booking.id}</Text>
                    <Text style={styles.bookingDateTime}>
                      {booking.date} • {booking.time}
                    </Text>
                  </View>
                  <View style={styles.statusContainer}>
                    {getStatusIcon(booking.status)}
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(booking.status) },
                      ]}>
                      {booking.status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.addressContainer}>
                  <View style={styles.addressRow}>
                    <MapPin size={16} color="#10B981" strokeWidth={2} />
                    <Text style={styles.addressText} numberOfLines={1}>
                      {booking.from}
                    </Text>
                  </View>
                  <View style={styles.addressDivider} />
                  <View style={styles.addressRow}>
                    <MapPin size={16} color="#EF4444" strokeWidth={2} />
                    <Text style={styles.addressText} numberOfLines={1}>
                      {booking.to}
                    </Text>
                  </View>
                </View>

                <View style={styles.bookingFooter}>
                  <View style={styles.bookingDetails}>
                    <Text style={styles.parcelSize}>
                      Size: {booking.parcelSize.charAt(0).toUpperCase() + booking.parcelSize.slice(1)}
                    </Text>
                    {booking.riderName && (
                      <Text style={styles.riderName}>Rider: {booking.riderName}</Text>
                    )}
                  </View>
                  <Text style={styles.price}>{booking.price}</Text>
                </View>

                {booking.status === 'in_transit' && (
                  <View style={styles.actionContainer}>
                    <Text style={styles.trackText}>Tap to track delivery →</Text>
                  </View>
                )}

                {canCustomerCancelDelivery(
                  deliveries.find((d) => d.id === booking.deliveryId)?.status ?? '',
                  booking.riderId
                ) && (
                  <View style={styles.actionContainer}>
                    <TouchableOpacity
                      style={[styles.cancelButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.error }]}
                      onPress={() => handleCancelDelivery(booking)}
                      disabled={cancellingId === booking.deliveryId}
                    >
                      {cancellingId === booking.deliveryId ? (
                        <ActivityIndicator size="small" color={theme.colors.error} />
                      ) : (
                        <>
                          <X size={18} color={theme.colors.error} strokeWidth={2} />
                          <Text style={[styles.cancelButtonText, { color: theme.colors.error }]}>Cancel delivery</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {booking.status === 'delivered' && booking.riderId && (
                  <View style={styles.actionContainer}>
                    {hasRated(booking.deliveryId) ? (
                      <View style={styles.ratedRow}>
                        <Star size={16} color="#F59E0B" fill="#F59E0B" strokeWidth={2} />
                        <Text style={[styles.ratedText, { color: theme.colors.textSecondary }]}>
                          Rated {getRatingForDelivery(booking.deliveryId)?.rating} ★
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.rateButton, { backgroundColor: theme.colors.primary }]}
                        onPress={() => {
                          setRateModalBooking(booking);
                          setRateStars(0);
                          setRateReviewText('');
                        }}
                      >
                        <Star size={18} color="#FFFFFF" strokeWidth={2} />
                        <Text style={styles.rateButtonText}>Rate & Review</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {(booking.status === 'delivered' || booking.status === 'cancelled') && (
                  <View style={styles.actionContainer}>
                    <TouchableOpacity
                      style={[styles.rebookButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary }]}
                      onPress={() => handleRebook(booking)}
                    >
                      <RotateCcw size={18} color={theme.colors.primary} strokeWidth={2} />
                      <Text style={[styles.rebookButtonText, { color: theme.colors.primary }]}>Rebook</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            ))}

            {getFilteredBookings().length === 0 && (
              <View style={styles.emptyState}>
                <Package size={48} color={theme.colors.textSecondary} strokeWidth={2} />
                <Text style={styles.emptyStateTitle}>No bookings found</Text>
                <Text style={styles.emptyStateText}>
                  {activeTab === 'active'
                    ? 'You have no active deliveries'
                    : activeTab === 'completed'
                    ? 'No completed deliveries yet'
                    : 'Start by booking your first delivery'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={() => router.push('/booking')}>
                  <Text style={styles.emptyStateButtonText}>Book a Delivery</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Rate & Review Modal */}
          <Modal
            visible={!!rateModalBooking}
            transparent
            animationType="fade"
            onRequestClose={() => setRateModalBooking(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.rateModalCard, { backgroundColor: theme.colors.card }]}>
                <View style={styles.rateModalHeader}>
                  <Text style={[styles.rateModalTitle, { color: theme.colors.text }]}>Rate your delivery</Text>
                  <TouchableOpacity onPress={() => setRateModalBooking(null)} style={styles.rateModalClose}>
                    <X size={24} color={theme.colors.text} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.rateModalSubtitle, { color: theme.colors.textSecondary }]}>
                  How was your experience?
                </Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity
                      key={n}
                      onPress={() => { tapLight(); setRateStars(n); }}
                      style={styles.starButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Star
                        size={36}
                        color="#F59E0B"
                        fill={rateStars >= n ? '#F59E0B' : 'transparent'}
                        strokeWidth={2}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[
                    styles.reviewInput,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  placeholder="Add a review (optional)"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={rateReviewText}
                  onChangeText={setRateReviewText}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[
                    styles.rateSubmitButton,
                    { backgroundColor: theme.colors.primary },
                    (rateStars < 1 || submittingRating) && styles.rateSubmitButtonDisabled,
                  ]}
                  onPress={async () => {
                    if (!rateModalBooking?.riderId || rateStars < 1 || submittingRating) return;
                    setSubmittingRating(true);
                    try {
                      await submitRating(
                        rateModalBooking.deliveryId,
                        rateModalBooking.riderId,
                        rateStars,
                        rateReviewText.trim() || undefined
                      );
                      setRateModalBooking(null);
                      setRateStars(0);
                      setRateReviewText('');
                      refetchRatings();
                      notifySuccess();
                    } catch (e) {
                      notifyError();
                      showToast(e instanceof Error ? e.message : 'Could not submit rating.', 'error');
                    } finally {
                      setSubmittingRating(false);
                    }
                  }}
                  disabled={rateStars < 1 || submittingRating}
                >
                  {submittingRating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.rateSubmitButtonText}>Submit rating</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
}
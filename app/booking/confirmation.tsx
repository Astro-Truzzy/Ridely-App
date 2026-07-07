import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import {
  ArrowLeft,
  CheckCircle,
  CreditCard,
  Wallet,
  DollarSign,
  MapPin,
  Clock,
  Package,
  X,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useAuth } from '@/contexts/AuthContext';
import { usePaymentMethods, type PaymentMethodDisplay } from '@/hooks/usePaymentMethods';
import { useWallet } from '@/hooks/useWallet';
import { supabase } from '@/lib/supabase';
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  chargePaystackSavedCard,
  getPaystackCallbackPath,
  PAYSTACK_NEW_CARD_OPTION_ID,
} from '@/lib/paystack';

type PaymentOption = PaymentMethodDisplay & { icon: typeof CreditCard };

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

  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { createDelivery } = useDeliveries();
  const { user, userProfile } = useAuth();
  const { showAlert } = useAlert();
  const { methods: savedMethods, loading: methodsLoading, addPlaceholderMethodsIfEmpty } =
    usePaymentMethods();
  const { balance: walletBalance } = useWallet();
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [isBooking, setIsBooking] = useState(false);
  const [paystackAuthUrl, setPaystackAuthUrl] = useState<string | null>(null);
  const [paystackLoading, setPaystackLoading] = useState(false);

  useEffect(() => {
    addPlaceholderMethodsIfEmpty();
  }, [addPlaceholderMethodsIfEmpty]);

  const paymentMethods: PaymentOption[] = useMemo(() => {
    const iconFor = (type: PaymentMethodDisplay['type']) => {
      if (type === 'cash') return DollarSign;
      if (type === 'wallet') return Wallet;
      return CreditCard;
    };

    const options: PaymentOption[] = savedMethods
      .filter((m) => m.type === 'card' || m.type === 'cash' || m.type === 'wallet')
      .map((m) => ({
        ...m,
        details:
          m.type === 'wallet'
            ? `Balance: ₦${(walletBalance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
            : m.details,
        icon: iconFor(m.type),
      }));

    const hasChargeableCard = savedMethods.some(
      (m) => m.type === 'card' && !!m.gatewayPaymentMethodId
    );
    if (hasChargeableCard || savedMethods.some((m) => m.type === 'card')) {
      options.push({
        id: PAYSTACK_NEW_CARD_OPTION_ID,
        type: 'card',
        label: 'Pay with a different card',
        details: 'Opens secure Paystack checkout',
        icon: CreditCard,
        isDefault: false,
        gatewayPaymentMethodId: null,
      });
    } else {
      options.unshift({
        id: PAYSTACK_NEW_CARD_OPTION_ID,
        type: 'card',
        label: 'Pay with card',
        details: 'Opens secure Paystack checkout',
        icon: CreditCard,
        isDefault: true,
        gatewayPaymentMethodId: null,
      });
    }

    return options;
  }, [savedMethods, walletBalance]);

  useEffect(() => {
    if (paymentMethods.length === 0 || selectedPayment) return;
    const defaultSaved = savedMethods.find((m) => m.isDefault && m.type === 'card' && m.gatewayPaymentMethodId);
    const defaultAny = savedMethods.find((m) => m.isDefault);
    const cash = savedMethods.find((m) => m.type === 'cash');
    if (defaultSaved) setSelectedPayment(defaultSaved.id);
    else if (defaultAny) setSelectedPayment(defaultAny.id);
    else if (cash) setSelectedPayment(cash.id);
    else setSelectedPayment(paymentMethods[0]?.id ?? PAYSTACK_NEW_CARD_OPTION_ID);
  }, [paymentMethods, savedMethods, selectedPayment]);

  const completeBooking = useCallback(async () => {
    if (!user) return;
    const deliveryData = {
      user_id: user.id,
      pickup_address: pickupAddress,
      dropoff_address: dropoffAddress,
      parcel_size: size as 'small' | 'medium' | 'large',
      total_cost: parseFloat(price),
      distance: parseFloat(distance),
      estimated_time: '25-35 mins',
      delivery_time: deliveryTime as 'now' | 'scheduled',
      scheduled_time: deliveryTime === 'scheduled' && scheduledTime ? scheduledTime : null,
    };
    const newDelivery = await createDelivery(deliveryData) as { id: string } | null;
    if (user && pickupLat != null && pickupLon != null && newDelivery?.id) {
      try {
        // @ts-expect-error - find_nearby_riders RPC args not in generated types
        const { data: nearbyRiders } = (await supabase.rpc('find_nearby_riders', {
          pickup_lat: parseFloat(pickupLat),
          pickup_lng: parseFloat(pickupLon),
          radius: 5000,
        })) as { data: { id: string }[] | null };
        if (Array.isArray(nearbyRiders) && nearbyRiders.length > 0) {
          const notifications = nearbyRiders.map((r: { id: string }) => ({
            user_id: user.id,
            rider_id: r.id,
            type: 'job_request',
            title: 'New delivery request',
            message: `Pickup: ${pickupAddress?.split(',')[0] ?? 'See details'} → Dropoff nearby. Tap to view.`,
            read: false,
            actionable: true,
            delivery_id: newDelivery.id,
          }));
          // @ts-expect-error - notifications table insert not in generated types
          await supabase.from('notifications').insert(notifications);
          // Send push notifications to riders
          const pushBody = {
            riderIds: nearbyRiders.map((r: { id: string }) => r.id),
            title: 'New delivery request',
            body: `Pickup: ${pickupAddress?.split(',')[0] ?? 'See details'} → Dropoff nearby. Tap to accept or decline.`,
            data: { type: 'job_request', deliveryId: newDelivery.id },
          };
          try {
            await supabase.functions.invoke('send-push', { body: pushBody });
          } catch (pushErr) {
            console.warn('Push send failed (riders may still get in-app notification):', pushErr);
          }
        }
      } catch (rpcErr) {
        console.warn('Proximity match / notify failed (booking still succeeded):', rpcErr);
      }
    }
    showAlert(
      'Booking Confirmed! 🎉',
      'Your delivery has been booked successfully. You will receive a notification when a rider accepts your request.',
      [
        { text: 'View Bookings', onPress: () => router.replace('/(tabs)/bookings') },
        { text: 'Go to Home', onPress: () => router.replace('/(tabs)') },
      ]
    );
  }, [user, pickupAddress, dropoffAddress, size, price, distance, deliveryTime, scheduledTime, pickupLat, pickupLon, createDelivery]);

  const startNewCardPayment = useCallback(async () => {
    const email = user?.email || userProfile?.email || '';
    if (!email) {
      showAlert('Error', 'Your account email is required for card payment.');
      return;
    }
    const amountKobo = Math.round(parseFloat(price || '0') * 100);
    if (amountKobo < 100) {
      showAlert('Error', 'Amount must be at least ₦1.00');
      return;
    }
    setPaystackLoading(true);
    try {
      const { authorization_url } = await initializePaystackTransaction({
        amountInKobo: amountKobo,
        email,
        metadata: user?.id
          ? { source: 'ridely_booking', user_id: user.id }
          : { source: 'ridely_booking' },
      });
      setPaystackAuthUrl(authorization_url);
    } catch (e) {
      showAlert(
        'Payment error',
        e instanceof Error ? e.message : 'Could not start payment. Check README_PAYMENT_METHODS for setup.'
      );
    } finally {
      setPaystackLoading(false);
    }
  }, [user?.id, user?.email, userProfile?.email, price, showAlert]);

  const handleBooking = async () => {
    if (!user) {
      showAlert('Error', 'You must be logged in to create a booking');
      return;
    }

    if (!selectedPayment) {
      showAlert('Error', 'Please select a payment method.');
      return;
    }

    const selected = paymentMethods.find((m) => m.id === selectedPayment);
    if (!selected) {
      showAlert('Error', 'Invalid payment method.');
      return;
    }

    if (selected.type === 'wallet') {
      showAlert('Not available', 'Paying with Ridely Wallet is coming soon. Choose card or cash.');
      return;
    }

    if (selected.type === 'cash') {
      setIsBooking(true);
      try {
        await completeBooking();
      } catch (error: unknown) {
        console.error('Error creating delivery:', error);
        showAlert(
          'Booking Failed',
          error instanceof Error ? error.message : 'Failed to create booking. Please try again.'
        );
      } finally {
        setIsBooking(false);
      }
      return;
    }

    const useNewCardCheckout = selectedPayment === PAYSTACK_NEW_CARD_OPTION_ID;
    const savedCard =
      selected.type === 'card' && selected.gatewayPaymentMethodId
        ? selected
        : null;

    if (useNewCardCheckout) {
      await startNewCardPayment();
      return;
    }

    if (savedCard?.gatewayPaymentMethodId) {
      const email = user.email || userProfile?.email || '';
      if (!email) {
        showAlert('Error', 'Your account email is required for card payment.');
        return;
      }
      const amountKobo = Math.round(parseFloat(price || '0') * 100);
      if (amountKobo < 100) {
        showAlert('Error', 'Amount must be at least ₦1.00');
        return;
      }

      setPaystackLoading(true);
      try {
        const chargeResult = await chargePaystackSavedCard({
          amountInKobo: amountKobo,
          email,
          paymentMethodId: savedCard.id,
          authorizationCode: savedCard.gatewayPaymentMethodId,
          reference: `ridely_booking_${user.id}_${Date.now()}`,
        });
        if (!chargeResult.success) {
          showAlert('Payment failed', chargeResult.error || 'Could not charge your saved card.');
          return;
        }
        setIsBooking(true);
        await completeBooking();
      } catch (e) {
        showAlert(
          'Payment error',
          e instanceof Error ? e.message : 'Could not charge saved card. Try paying with a different card.'
        );
      } finally {
        setPaystackLoading(false);
        setIsBooking(false);
      }
      return;
    }

    await startNewCardPayment();
  };

  const handlePaystackCallback = useCallback(
    async (url: string) => {
      const callbackPath = getPaystackCallbackPath();
      if (!callbackPath || !url.includes('/paystack-callback') || !url.includes('reference=')) return null;
      const match = url.match(/reference=([^&]+)/);
      const reference = match ? decodeURIComponent(match[1]) : null;
      if (!reference) return null;
      const result = await verifyPaystackTransaction(reference);
      return result.success ? reference : null;
    },
    []
  );

  const closePaystackWebView = useCallback(() => {
    setPaystackAuthUrl(null);
  }, []);

  const onPaystackNavigationStateChange = useCallback(
    async (navState: { url: string }) => {
      const url = navState?.url || '';
      const success = await handlePaystackCallback(url);
      if (!success) return;
      closePaystackWebView();
      setIsBooking(true);
      try {
        await completeBooking();
      } catch (e) {
        showAlert('Booking Failed', e instanceof Error ? e.message : 'Could not complete booking.');
      } finally {
        setIsBooking(false);
      }
    },
    [handlePaystackCallback, closePaystackWebView, completeBooking]
  );

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
        <Text style={[styles.title, { color: theme.colors.text }]}>Confirm Booking</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressStep, { backgroundColor: theme.colors.success }]} />
            <View style={[styles.progressStep, { backgroundColor: theme.colors.success }]} />
            <View style={[styles.progressStep, { backgroundColor: theme.colors.success }]} />
            <View style={[styles.progressStep, { backgroundColor: theme.colors.primary }]} />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>Step 4 of 4</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Summary Card */}
          <View style={[
            styles.summaryCard,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.success,
            },
            theme.shadows.large,
          ]}>
            <View style={styles.summaryHeader}>
              <CheckCircle size={32} color={theme.colors.success} strokeWidth={2} />
              <View style={styles.summaryInfo}>
                <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>Almost Done!</Text>
                <Text style={[styles.summarySubtitle, { color: theme.colors.textSecondary }]}>
                  Review and confirm your booking
                </Text>
              </View>
              <Text style={[styles.totalPrice, { color: theme.colors.success }]}>
                ₦{parseFloat(price || '0').toLocaleString('en-NG')}
              </Text>
            </View>
          </View>

          {/* Booking Details */}
          <View style={[
            styles.detailsCard,
            { backgroundColor: theme.colors.card },
            theme.shadows.medium,
          ]}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Booking Summary</Text>
            
            <View style={styles.detailRow}>
              <Package size={20} color={theme.colors.primary} strokeWidth={2} />
              <View style={styles.detailInfo}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Package Size</Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>{getSizeLabel(size)}</Text>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <MapPin size={20} color={theme.colors.success} strokeWidth={2} />
              <View style={styles.detailInfo}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Pickup</Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]} numberOfLines={2}>{pickupAddress}</Text>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <MapPin size={20} color={theme.colors.error} strokeWidth={2} />
              <View style={styles.detailInfo}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Dropoff</Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]} numberOfLines={2}>{dropoffAddress}</Text>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <Clock size={20} color={theme.colors.warning} strokeWidth={2} />
              <View style={styles.detailInfo}>
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Delivery Time</Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                  {deliveryTime === 'now' 
                    ? 'Immediate Pickup' 
                    : `Scheduled: ${scheduledTime || 'Later'}`}
                </Text>
              </View>
            </View>
            
            <View style={[styles.estimateRow, { borderTopColor: theme.colors.border }]}>
              <Text style={[styles.estimateText, { color: theme.colors.textSecondary }]}>
                📍 Distance: {distance} km • ⏱️ Est. delivery: 25-35 mins
              </Text>
            </View>
          </View>

          {/* Payment Method */}
          <View style={[
            styles.paymentCard,
            { backgroundColor: theme.colors.card },
            theme.shadows.medium,
          ]}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Payment Method</Text>

            {methodsLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 16 }} />
            ) : null}

            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.paymentOption,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.card,
                  },
                  selectedPayment === method.id && {
                    borderColor: theme.colors.primary,
                    backgroundColor: isDark ? theme.colors.surface : theme.colors.primary + '12',
                  },
                ]}
                onPress={() => setSelectedPayment(method.id)}>
                <View style={[styles.paymentIcon, { backgroundColor: theme.colors.surface }]}>
                  <method.icon size={24} color={theme.colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={[styles.paymentLabel, { color: theme.colors.text }]}>{method.label}</Text>
                  <Text style={[styles.paymentDetails, { color: theme.colors.textSecondary }]}>{method.details}</Text>
                </View>
                {selectedPayment === method.id && (
                  <View style={[styles.checkmark, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Terms */}
          <View style={styles.termsContainer}>
            <Text style={[styles.termsText, { color: theme.colors.textSecondary }]}>
              By confirming this booking, you agree to our{' '}
              <Text style={[styles.termsLink, { color: theme.colors.primary }]}>Terms of Service</Text> and{' '}
              <Text style={[styles.termsLink, { color: theme.colors.primary }]}>Privacy Policy</Text>. The rider will arrive
              within the estimated time frame.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View style={[styles.bottomContainer, {
        backgroundColor: theme.colors.card,
        borderTopColor: theme.colors.border,
      }]}>
        <TouchableOpacity
          style={[
            styles.bookingButton,
            { backgroundColor: theme.colors.primary },
            (isBooking || paystackLoading) && { backgroundColor: theme.colors.textTertiary },
          ]}
          onPress={handleBooking}
          disabled={isBooking || paystackLoading}>
          <Text style={styles.bookingText}>
            {paystackLoading
              ? selectedPayment !== PAYSTACK_NEW_CARD_OPTION_ID &&
                paymentMethods.find((m) => m.id === selectedPayment)?.gatewayPaymentMethodId
                ? 'Charging card...'
                : 'Opening payment...'
              : isBooking
                ? 'Confirming Booking...'
                : paymentMethods.find((m) => m.id === selectedPayment)?.type === 'cash'
                  ? 'Confirm'
                  : `Confirm & Pay ₦${parseFloat(price || '0').toLocaleString('en-NG')}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Paystack card payment WebView */}
      <Modal visible={!!paystackAuthUrl} animationType="slide" onRequestClose={closePaystackWebView}>
        <SafeAreaView style={[styles.paystackModal, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.paystackHeader, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={closePaystackWebView} style={styles.paystackClose}>
              <X size={24} color={theme.colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={[styles.paystackHeaderTitle, { color: theme.colors.text }]}>Complete payment</Text>
            <View style={styles.paystackClose} />
          </View>
          {paystackAuthUrl ? (
            <WebView
              source={{ uri: paystackAuthUrl }}
              style={styles.webview}
              onNavigationStateChange={onPaystackNavigationStateChange}
            />
          ) : (
            <View style={styles.webviewPlaceholder}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          )}
        </SafeAreaView>
      </Modal>
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
  summaryCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 2,
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
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 14,
  },
  totalPrice: {
    fontSize: 28,
    fontWeight: '700',
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
    fontWeight: '500',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  estimateRow: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  estimateText: {
    fontSize: 12,
    textAlign: 'center',
  },
  paymentCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    marginBottom: 4,
  },
  paymentDetails: {
    fontSize: 14,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    lineHeight: 18,
    textAlign: 'center',
  },
  termsLink: {
    fontWeight: '500',
  },
  bottomContainer: {
    padding: 20,
    borderTopWidth: 1,
  },
  bookingButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  bookingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  paystackModal: {
    flex: 1,
  },
  paystackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  paystackClose: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paystackHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
  },
  webviewPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
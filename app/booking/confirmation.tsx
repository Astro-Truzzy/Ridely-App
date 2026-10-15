import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Text } from '@/components/Text';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import {
  ArrowLeft,
  CheckCircle,
  CreditCard,
  Wallet,
  Landmark,
  MapPin,
  Clock,
  Package,
  X,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useAuth } from '@/contexts/AuthContext';
import {
  usePaymentMethods,
  type PaymentMethodDisplay,
} from '@/hooks/usePaymentMethods';
import { useWallet } from '@/hooks/useWallet';
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  chargePaystackSavedCard,
  getPaystackCallbackPath,
  initializeBankTransferCheckout,
  fetchPaymentStatus,
  PAYSTACK_NEW_CARD_OPTION_ID,
  BANK_TRANSFER_OPTION_ID,
} from '@/lib/paystack';
import { TestPaymentsBanner } from '@/components/TestPaymentsBanner';
import { FormError } from '@/components/FormError';

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
  const { showToast } = useAlert();
  const {
    methods: savedMethods,
    loading: methodsLoading,
    addPlaceholderMethodsIfEmpty,
  } = usePaymentMethods();
  const { balance: walletBalance } = useWallet();
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [isBooking, setIsBooking] = useState(false);
  const [paystackAuthUrl, setPaystackAuthUrl] = useState<string | null>(null);
  const [paystackLoading, setPaystackLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const handledPaymentRef = useRef<string | null>(null);
  const [transferCheckout, setTransferCheckout] = useState<{
    reference: string;
    amount_kobo: number;
    authorization_url: string | null;
  } | null>(null);
  const [transferStatus, setTransferStatus] = useState<string | null>(null);
  const [transferChecking, setTransferChecking] = useState(false);

  useEffect(() => {
    addPlaceholderMethodsIfEmpty();
  }, [addPlaceholderMethodsIfEmpty]);

  const paymentMethods: PaymentOption[] = useMemo(() => {
    const iconFor = (type: PaymentMethodDisplay['type']) => {
      if (type === 'wallet') return Wallet;
      return CreditCard;
    };

    // Cash-on-delivery is retired for new bookings — cash methods never appear
    // at checkout (existing rows remain visible under Profile for history).
    const options: PaymentOption[] = savedMethods
      .filter((m) => m.type === 'card')
      .map((m) => ({
        ...m,
        details:
          m.type === 'wallet'
            ? `Coming soon · Balance: ₦${(walletBalance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
            : m.details,
        icon: iconFor(m.type),
      }));

    const hasChargeableCard = savedMethods.some(
      (m) => m.type === 'card' && !!m.gatewayPaymentMethodId,
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

    options.push({
      id: BANK_TRANSFER_OPTION_ID,
      type: 'bank',
      label: 'Bank transfer',
      details: 'Transfer to Ridely account · confirmed automatically',
      icon: Landmark,
      isDefault: false,
      gatewayPaymentMethodId: null,
    });

    return options;
  }, [savedMethods, walletBalance]);

  useEffect(() => {
    if (paymentMethods.length === 0 || selectedPayment) return;
    const defaultSaved = savedMethods.find(
      (m) => m.isDefault && m.type === 'card' && m.gatewayPaymentMethodId,
    );
    const defaultAny = savedMethods.find(
      (m) => m.isDefault && m.type === 'card',
    );
    if (defaultSaved) setSelectedPayment(defaultSaved.id);
    else if (defaultAny) setSelectedPayment(defaultAny.id);
    else
      setSelectedPayment(paymentMethods[0]?.id ?? PAYSTACK_NEW_CARD_OPTION_ID);
  }, [paymentMethods, savedMethods, selectedPayment]);

  const completeBooking = useCallback(
    async (opts: {
      payment_method: 'card';
      payment_reference?: string | null;
    }) => {
      if (!user) return;
      await createDelivery({
        pickup_address: pickupAddress,
        dropoff_address: dropoffAddress,
        pickup_lat: pickupLat != null ? parseFloat(pickupLat) : null,
        pickup_lng: pickupLon != null ? parseFloat(pickupLon) : null,
        dropoff_lat: dropoffLat != null ? parseFloat(dropoffLat) : null,
        dropoff_lng: dropoffLon != null ? parseFloat(dropoffLon) : null,
        parcel_size: size as 'small' | 'medium' | 'large',
        total_cost: parseFloat(price),
        distance: parseFloat(distance),
        estimated_time: '25-35 mins',
        delivery_time: deliveryTime as 'now' | 'scheduled',
        scheduled_time:
          deliveryTime === 'scheduled' && scheduledTime ? scheduledTime : null,
        payment_method: opts.payment_method,
        payment_reference: opts.payment_reference ?? null,
      });
      showToast('Delivery booked. We will notify you when a rider accepts.');
      router.replace('/(tabs)/bookings');
    },
    [
      user,
      pickupAddress,
      dropoffAddress,
      size,
      price,
      distance,
      deliveryTime,
      scheduledTime,
      pickupLat,
      pickupLon,
      dropoffLat,
      dropoffLon,
      createDelivery,
      showToast,
    ],
  );

  const startNewCardPayment = useCallback(async () => {
    const email = user?.email || userProfile?.email || '';
    if (!email) {
      setFormError('Your account email is required for card payment.');
      return;
    }
    const amountKobo = Math.round(parseFloat(price || '0') * 100);
    if (amountKobo < 100) {
      setFormError('Amount must be at least ₦1.00');
      return;
    }
    setPaystackLoading(true);
    try {
      const { authorization_url } = await initializePaystackTransaction({
        amountInKobo: amountKobo,
        email,
        metadata: {
          source: 'ridely_booking',
          intent: 'booking',
          ...(user?.id ? { user_id: user.id } : {}),
        },
      });
      setPaystackAuthUrl(authorization_url);
    } catch (e) {
      setFormError(
        e instanceof Error
          ? e.message
          : 'Could not start payment. Check README_PAYMENT_METHODS for setup.',
      );
    } finally {
      setPaystackLoading(false);
    }
  }, [user?.id, user?.email, userProfile?.email, price]);

  const checkTransferStatus = useCallback(async () => {
    if (!transferCheckout) return;
    setTransferChecking(true);
    try {
      const status = await fetchPaymentStatus(transferCheckout.reference);
      setTransferStatus(status.status);
      if (status.status === 'successful') {
        showToast('Payment confirmed. We will notify you when a rider accepts.');
        router.replace('/(tabs)/bookings');
      } else if (status.status === 'failed' || status.status === 'expired') {
        setFormError(
          status.failure_reason ||
            'This transfer could not be confirmed. Please try again or contact support.'
        );
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not check payment status.');
    } finally {
      setTransferChecking(false);
    }
  }, [transferCheckout, showToast]);

  // Auto-refresh the waiting screen; the booking completes when the verified
  // webhook settles the transfer (never on client claim).
  useEffect(() => {
    if (!transferCheckout) return;
    const timer = setInterval(() => {
      checkTransferStatus();
    }, 15000);
    return () => clearInterval(timer);
  }, [transferCheckout, checkTransferStatus]);

  const startBankTransferPayment = useCallback(async () => {
    const email = user?.email || userProfile?.email || '';
    if (!email) {
      setFormError('Your account email is required for bank transfer payment.');
      return;
    }
    setFormError(null);
    setPaystackLoading(true);
    try {
      const init = await initializeBankTransferCheckout({
        pickup_address: pickupAddress,
        dropoff_address: dropoffAddress,
        pickup_lat: pickupLat != null ? parseFloat(pickupLat) : null,
        pickup_lng: pickupLon != null ? parseFloat(pickupLon) : null,
        dropoff_lat: dropoffLat != null ? parseFloat(dropoffLat) : null,
        dropoff_lng: dropoffLon != null ? parseFloat(dropoffLon) : null,
        parcel_size: size as 'small' | 'medium' | 'large',
        total_cost: parseFloat(price),
        distance: parseFloat(distance),
        estimated_time: '25-35 mins',
        delivery_time: deliveryTime as 'now' | 'scheduled',
        scheduled_time:
          deliveryTime === 'scheduled' && scheduledTime ? scheduledTime : null,
        email,
        idempotencyKey: `booking_${user?.id ?? 'guest'}_${Date.now()}`.slice(0, 64),
      });
      setTransferCheckout({
        reference: init.reference,
        amount_kobo: init.amount_kobo,
        authorization_url: init.authorization_url,
      });
      setTransferStatus('pending');
      if (init.authorization_url) {
        setPaystackAuthUrl(init.authorization_url);
      }
    } catch (e) {
      setFormError(
        e instanceof Error
          ? e.message
          : 'Could not start bank transfer checkout. Try card payment instead.'
      );
    } finally {
      setPaystackLoading(false);
    }
  }, [
    user,
    userProfile?.email,
    pickupAddress,
    dropoffAddress,
    pickupLat,
    pickupLon,
    dropoffLat,
    dropoffLon,
    size,
    price,
    distance,
    deliveryTime,
    scheduledTime,
  ]);

  const handleBooking = async () => {
    if (!user) {
      setFormError('You must be logged in to create a booking');
      return;
    }

    // A transfer checkout is already in flight — reopen the payment page.
    if (transferCheckout?.authorization_url) {
      setPaystackAuthUrl(transferCheckout.authorization_url);
      return;
    }

    if (!selectedPayment) {
      setFormError('Please select a payment method.');
      return;
    }

    const selected = paymentMethods.find((m) => m.id === selectedPayment);
    if (!selected) {
      setFormError('Invalid payment method.');
      return;
    }

    if (selected.type === 'wallet') {
      setFormError('Paying with Ridely Wallet is coming soon. Choose card or bank transfer.');
      return;
    }

    if (selected.id === BANK_TRANSFER_OPTION_ID) {
      await startBankTransferPayment();
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
        setFormError('Your account email is required for card payment.');
        return;
      }
      const amountKobo = Math.round(parseFloat(price || '0') * 100);
      if (amountKobo < 100) {
        setFormError('Amount must be at least ₦1.00');
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
          metadata: {
            intent: 'booking',
            source: 'ridely_booking',
            user_id: user.id,
          },
        });
        if (!chargeResult.success || !chargeResult.reference) {
          setFormError(chargeResult.error || 'Could not charge your saved card.');
          return;
        }
        setIsBooking(true);
        await completeBooking({
          payment_method: 'card',
          payment_reference: chargeResult.reference,
        });
      } catch (e) {
        setFormError(
          e instanceof Error
            ? e.message
            : 'Could not charge saved card. Try paying with a different card.',
        );
      } finally {
        setPaystackLoading(false);
        setIsBooking(false);
      }
      return;
    }

    await startNewCardPayment();
  };

  const handlePaystackCallback = useCallback(async (url: string) => {
    const callbackPath = getPaystackCallbackPath();
    if (
      !callbackPath ||
      !url.includes('/paystack-callback') ||
      !url.includes('reference=')
    )
      return null;
    const match = url.match(/reference=([^&]+)/);
    const reference = match ? decodeURIComponent(match[1]) : null;
    if (!reference) return null;
    const result = await verifyPaystackTransaction(reference);
    return result.success ? reference : null;
  }, []);

  const closePaystackWebView = useCallback(() => {
    setPaystackAuthUrl(null);
  }, []);

  const onPaystackNavigationStateChange = useCallback(
    async (navState: { url: string }) => {
      const url = navState?.url || '';
      const success = await handlePaystackCallback(url);
      if (!success) return;
      if (handledPaymentRef.current === success) return;
      handledPaymentRef.current = success;
      closePaystackWebView();
      setIsBooking(true);
      try {
        await completeBooking({
          payment_method: 'card',
          payment_reference: success,
        });
      } catch (e) {
        setFormError(e instanceof Error ? e.message : 'Could not complete booking.');
      } finally {
        setIsBooking(false);
      }
    },
    [handlePaystackCallback, closePaystackWebView, completeBooking],
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
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.card,
            borderBottomColor: theme.colors.border,
            paddingTop: 16 + insets.top,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.colors.surface }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Confirm Booking
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressStep,
                { backgroundColor: theme.colors.success },
              ]}
            />
            <View
              style={[
                styles.progressStep,
                { backgroundColor: theme.colors.success },
              ]}
            />
            <View
              style={[
                styles.progressStep,
                { backgroundColor: theme.colors.success },
              ]}
            />
            <View
              style={[
                styles.progressStep,
                { backgroundColor: theme.colors.primary },
              ]}
            />
          </View>
          <Text
            style={[styles.progressText, { color: theme.colors.textSecondary }]}
          >
            Step 4 of 4
          </Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Summary Card */}
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.success,
              },
              theme.shadows.large,
            ]}
          >
            <View style={styles.summaryHeader}>
              <CheckCircle
                size={32}
                color={theme.colors.success}
                strokeWidth={2}
              />
              <View style={styles.summaryInfo}>
                <Text
                  style={[styles.summaryTitle, { color: theme.colors.text }]}
                >
                  Almost Done!
                </Text>
                <Text
                  style={[
                    styles.summarySubtitle,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Review and confirm your booking
                </Text>
              </View>
              <Text
                style={[styles.totalPrice, { color: theme.colors.success }]}
              >
                ₦{parseFloat(price || '0').toLocaleString('en-NG')}
              </Text>
            </View>
          </View>

          {/* Booking Details */}
          <View
            style={[
              styles.detailsCard,
              { backgroundColor: theme.colors.card },
              theme.shadows.medium,
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              Booking Summary
            </Text>

            <View style={styles.detailRow}>
              <Package size={20} color={theme.colors.primary} strokeWidth={2} />
              <View style={styles.detailInfo}>
                <Text
                  style={[
                    styles.detailLabel,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Package Size
                </Text>
                <Text
                  style={[styles.detailValue, { color: theme.colors.text }]}
                >
                  {getSizeLabel(size)}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <MapPin size={20} color={theme.colors.success} strokeWidth={2} />
              <View style={styles.detailInfo}>
                <Text
                  style={[
                    styles.detailLabel,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Pickup
                </Text>
                <Text
                  style={[styles.detailValue, { color: theme.colors.text }]}
                  numberOfLines={2}
                >
                  {pickupAddress}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <MapPin size={20} color={theme.colors.error} strokeWidth={2} />
              <View style={styles.detailInfo}>
                <Text
                  style={[
                    styles.detailLabel,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Dropoff
                </Text>
                <Text
                  style={[styles.detailValue, { color: theme.colors.text }]}
                  numberOfLines={2}
                >
                  {dropoffAddress}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Clock size={20} color={theme.colors.warning} strokeWidth={2} />
              <View style={styles.detailInfo}>
                <Text
                  style={[
                    styles.detailLabel,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Delivery Time
                </Text>
                <Text
                  style={[styles.detailValue, { color: theme.colors.text }]}
                >
                  {deliveryTime === 'now'
                    ? 'Immediate Pickup'
                    : `Scheduled: ${scheduledTime || 'Later'}`}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.estimateRow,
                { borderTopColor: theme.colors.border },
              ]}
            >
              <Text
                style={[
                  styles.estimateText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                📍 Distance: {distance} km • ⏱️ Est. delivery: 25-35 mins
              </Text>
            </View>
          </View>

          {/* Payment Method */}
          <View
            style={[
              styles.paymentCard,
              { backgroundColor: theme.colors.card },
              theme.shadows.medium,
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              Payment Method
            </Text>
            <TestPaymentsBanner compact />

            {methodsLoading ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.primary}
                style={{ marginVertical: 16 }}
              />
            ) : null}

            {paymentMethods.map((method) => {
              const comingSoon = method.type === 'wallet';
              return (
                <TouchableOpacity
                  key={method.id}
                  disabled={comingSoon}
                  style={[
                    styles.paymentOption,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.card,
                    },
                    selectedPayment === method.id &&
                      !comingSoon && {
                        borderColor: theme.colors.primary,
                        backgroundColor: isDark
                          ? theme.colors.surface
                          : theme.colors.primary + '12',
                      },
                    comingSoon && { opacity: 0.7 },
                  ]}
                  onPress={() => {
                    if (comingSoon) return;
                    setSelectedPayment(method.id);
                  }}
                >
                  <View
                    style={[
                      styles.paymentIcon,
                      { backgroundColor: theme.colors.surface },
                    ]}
                  >
                    <method.icon
                      size={24}
                      color={theme.colors.primary}
                      strokeWidth={2}
                    />
                  </View>
                  <View style={styles.paymentInfo}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Text
                        style={[
                          styles.paymentLabel,
                          { color: theme.colors.text },
                        ]}
                      >
                        {method.label}
                      </Text>
                      {comingSoon ? (
                        <Text
                          style={[
                            styles.comingSoonBadge,
                            {
                              color: theme.colors.primary,
                              borderColor: theme.colors.primary,
                            },
                          ]}
                        >
                          Coming soon
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.paymentDetails,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {method.details}
                    </Text>
                  </View>
                  {selectedPayment === method.id && !comingSoon && (
                    <View
                      style={[
                        styles.checkmark,
                        { backgroundColor: theme.colors.primary },
                      ]}
                    >
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Bank transfer waiting state — updates only on server confirmation */}
          {transferCheckout ? (
            <View
              style={[
                styles.paymentCard,
                { backgroundColor: theme.colors.card },
                theme.shadows.medium,
              ]}
            >
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Awaiting bank transfer
              </Text>
              <Text
                style={[styles.paymentDetails, { color: theme.colors.textSecondary }]}
              >
                Transfer exactly ₦
                {(transferCheckout.amount_kobo / 100).toLocaleString('en-NG', {
                  minimumFractionDigits: 2,
                })}{' '}
                using the account shown on the payment page. Use reference{' '}
                <Text style={{ fontWeight: '700', color: theme.colors.text }}>
                  {transferCheckout.reference}
                </Text>{' '}
                if asked for a narration. Your booking is created and will go to
                riders automatically once the transfer is verified — do not mark it
                complete yourself.
              </Text>
              <Text
                style={[
                  styles.paymentDetails,
                  { color: theme.colors.textSecondary, marginTop: 8 },
                ]}
              >
                Status:{' '}
                <Text style={{ fontWeight: '700', color: theme.colors.text }}>
                  {transferChecking
                    ? 'Checking…'
                    : transferStatus === 'successful'
                      ? 'Confirmed'
                      : transferStatus === 'failed' || transferStatus === 'expired'
                        ? 'Needs attention'
                        : 'Awaiting payment'}
                </Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.bookingButton,
                  { backgroundColor: theme.colors.surface, marginTop: 16 },
                ]}
                onPress={checkTransferStatus}
                disabled={transferChecking}
              >
                <Text style={[styles.bookingText, { color: theme.colors.primary }]}>
                  {transferChecking ? 'Checking…' : 'Check payment status'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Terms */}
          <View style={styles.termsContainer}>
            <Text
              style={[styles.termsText, { color: theme.colors.textSecondary }]}
            >
              By confirming this booking, you agree to our{' '}
              <Text style={[styles.termsLink, { color: theme.colors.primary }]}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text style={[styles.termsLink, { color: theme.colors.primary }]}>
                Privacy Policy
              </Text>
              . The rider will arrive within the estimated time frame.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View
        style={[
          styles.bottomContainer,
          {
            backgroundColor: theme.colors.card,
            borderTopColor: theme.colors.border,
          },
        ]}
      >
        <FormError message={formError} />
        <TouchableOpacity
          style={[
            styles.bookingButton,
            { backgroundColor: theme.colors.primary },
            (isBooking || paystackLoading) && {
              backgroundColor: theme.colors.textTertiary,
            },
          ]}
          onPress={handleBooking}
          disabled={isBooking || paystackLoading}
        >
          <Text style={styles.bookingText}>
            {paystackLoading
              ? selectedPayment !== PAYSTACK_NEW_CARD_OPTION_ID &&
                paymentMethods.find((m) => m.id === selectedPayment)
                  ?.gatewayPaymentMethodId
                ? 'Charging card...'
                : 'Opening payment...'
              : isBooking
                ? 'Confirming Booking...'
                : transferCheckout
                  ? 'Continue payment'
                  : `Confirm & Pay ₦${parseFloat(price || '0').toLocaleString('en-NG')}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Paystack card payment WebView */}
      <Modal
        visible={!!paystackAuthUrl}
        animationType="slide"
        onRequestClose={closePaystackWebView}
      >
        <SafeAreaView
          style={[
            styles.paystackModal,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <View
            style={[
              styles.paystackHeader,
              {
                backgroundColor: theme.colors.card,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            <TouchableOpacity
              onPress={closePaystackWebView}
              style={styles.paystackClose}
            >
              <X size={24} color={theme.colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text
              style={[styles.paystackHeaderTitle, { color: theme.colors.text }]}
            >
              Complete payment
            </Text>
            <View style={styles.paystackClose} />
          </View>
          <TestPaymentsBanner />
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
  comingSoonBadge: {
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
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

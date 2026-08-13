import React, { useEffect } from 'react';
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
import {
  ArrowLeft,
  CreditCard,
  Plus,
  DollarSign,
  Wallet,
  MoreVertical,
  Check,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import { usePaymentMethods, type PaymentMethodDisplay } from '@/hooks/usePaymentMethods';
import { useWallet } from '@/hooks/useWallet';

export default function PaymentMethodsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { showAlert } = useAlert();
  const {
    methods: paymentMethods,
    loading,
    error,
    setDefault,
    remove,
    addPlaceholderMethodsIfEmpty,
  } = usePaymentMethods();
  const { balance: walletBalance } = useWallet();

  useEffect(() => {
    addPlaceholderMethodsIfEmpty();
  }, [addPlaceholderMethodsIfEmpty]);

  const setDefaultPayment = (id: string) => {
    setDefault(id);
    showAlert('Success', 'Default payment method updated');
  };

  const removePaymentMethod = (id: string) => {
    const method = paymentMethods.find(m => m.id === id);

    showAlert(
      'Remove Payment Method',
      `Are you sure you want to remove ${method?.label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => remove(id),
        },
      ]
    );
  };

  const handlePaymentAction = (method: PaymentMethodDisplay) => {
    if (method.type === 'cash' || method.type === 'wallet') {
      return; // No actions for these types
    }

    showAlert(
      method.label,
      'Choose an action',
      [
        {
          text: 'Set as Default',
          onPress: () => setDefaultPayment(method.id),
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removePaymentMethod(method.id),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const getPaymentIcon = (type: string) => {
    switch (type) {
      case 'card':
        return CreditCard;
      case 'wallet':
        return Wallet;
      case 'cash':
        return DollarSign;
      default:
        return CreditCard;
    }
  };

  const getCardBrandColor = (brand?: string) => {
    switch (brand) {
      case 'Visa':
        return '#1A1F71';
      case 'Mastercard':
        return '#EB001B';
      case 'Amex':
        return '#006FCF';
      default:
        return '#5A47FF';
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
        backgroundColor: theme.colors.surface,
        borderBottomColor: theme.colors.border,
        paddingTop: 16 + insets.top,
      }]}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: isDark ? theme.colors.card : '#F3F4F6' }]} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Payment Methods</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: isDark ? theme.colors.card : '#F0F2FF' }]}
          onPress={() => router.push('/profile/add-payment')}>
          <Plus size={20} color={isDark ? theme.colors.primary : '#5A47FF'} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={styles.section}>
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={[styles.section, styles.loadingContainer]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading payment methods...</Text>
          </View>
        ) : (
          <>
            {/* Current Methods */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text, paddingHorizontal: 20, marginTop: 24, marginBottom: 16 }]}>Your Payment Methods</Text>

              {paymentMethods.map((method) => {
                const IconComponent = getPaymentIcon(method.type);

                return (
                  <View key={method.id} style={[styles.paymentCard, {
                    backgroundColor: theme.colors.surface,
                    shadowColor: isDark ? '#000' : '#000',
                    borderBottomColor: theme.colors.border
                  }]}>
                    {method.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Check size={12} color="#FFFFFF" strokeWidth={2} />
                        <Text style={styles.defaultText}>Default</Text>
                      </View>
                    )}

                    <View style={styles.paymentHeader}>
                      <View style={[
                        styles.paymentIcon,
                        method.type === 'card'
                          ? { backgroundColor: getCardBrandColor(method.brand) }
                          : method.type === 'wallet'
                            ? { backgroundColor: '#5A47FF' }
                            : { backgroundColor: '#10B981' }
                      ]}>
                        <IconComponent size={24} color="#FFFFFF" strokeWidth={2} />
                      </View>

                      <View style={styles.paymentInfo}>
                        <Text style={[styles.paymentLabel, { color: theme.colors.text }]}>{method.label}</Text>
                        <Text style={[styles.paymentDetails, { color: theme.colors.textSecondary }]}>
                          {method.type === 'wallet' && walletBalance !== null
                            ? `Balance: ₦${Number(walletBalance).toFixed(2)}`
                            : method.details}
                        </Text>
                        {method.expiry ? (
                          <Text style={[styles.expiryText, { color: theme.colors.textTertiary }]}>{method.expiry}</Text>
                        ) : null}
                      </View>

                      {(method.type === 'card' || method.type === 'bank') && (
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: isDark ? theme.colors.card : '#F3F4F6' }]}
                          onPress={() => handlePaymentAction(method)}>
                          <MoreVertical size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Add New Payment */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text, paddingHorizontal: 20, marginBottom: 16 }]}>Add New Payment Method</Text>

              <TouchableOpacity
                style={[styles.addPaymentCard, { borderColor: theme.colors.border }]}
                onPress={() => router.push('/profile/add-payment')}>
                <View style={[styles.addPaymentIcon, { backgroundColor: isDark ? theme.colors.card : '#F3F4F6' }]}>
                  <CreditCard size={24} color="#5A47FF" strokeWidth={2} />
                </View>
                <View style={styles.addPaymentInfo}>
                  <Text style={[styles.addPaymentTitle, { color: theme.colors.text }]}>Add Credit/Debit Card</Text>
                  <Text style={[styles.addPaymentSubtitle, { color: theme.colors.textSecondary }]}>Visa, Mastercard, American Express</Text>
                </View>
                <Plus size={20} color={isDark ? theme.colors.primary : '#5A47FF'} strokeWidth={2} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addPaymentCard, { borderColor: theme.colors.border }]}
                onPress={() => router.push('/profile/fund-wallet')}>
                <View style={[styles.addPaymentIcon, { backgroundColor: isDark ? theme.colors.card : '#F3F4F6' }]}>
                  <Wallet size={24} color="#10B981" strokeWidth={2} />
                </View>
                <View style={styles.addPaymentInfo}>
                  <Text style={[styles.addPaymentTitle, { color: theme.colors.text }]}>Fund Wallet</Text>
                  <Text style={[styles.addPaymentSubtitle, { color: theme.colors.textSecondary }]}>Add money to your Ridely wallet</Text>
                </View>
                <Plus size={20} color={isDark ? theme.colors.success : '#10B981'} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Payment Security */}
        <View style={styles.section}>
          <View style={[styles.securityCard, { 
            backgroundColor: isDark ? theme.colors.info + '18' : '#F0F9FF',
            borderLeftColor: theme.colors.info
          }]}>
            <Text style={[styles.securityTitle, { color: isDark ? theme.colors.info : '#0C4A6E' }]}>🔒 Payment Security</Text>
            <Text style={[styles.securityText, { color: isDark ? theme.colors.textSecondary : '#0C4A6E' }]}>
              All payment information is encrypted and secure. We never store your full card
              details on our servers. Payments are processed through industry-standard secure
              payment gateways.
            </Text>
          </View>
        </View>
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  paymentCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  defaultBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  defaultText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
    marginBottom: 2,
  },
  expiryText: {
    fontSize: 12,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPaymentCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  addPaymentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  addPaymentInfo: {
    flex: 1,
  },
  addPaymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  addPaymentSubtitle: {
    fontSize: 14,
  },
  securityCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  securityText: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
});
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
  CreditCard,
  Plus,
  DollarSign,
  Wallet,
  MoreVertical,
  Check,
} from 'lucide-react-native';
import { router } from 'expo-router';

interface PaymentMethod {
  id: string;
  type: 'card' | 'cash' | 'wallet';
  label: string;
  details: string;
  lastFour?: string;
  isDefault: boolean;
  expiry?: string;
  brand?: string;
}

export default function PaymentMethodsScreen() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    {
      id: '1',
      type: 'card',
      label: 'Visa Card',
      details: 'Personal',
      lastFour: '4242',
      expiry: '12/26',
      brand: 'Visa',
      isDefault: true,
    },
    {
      id: '2',
      type: 'card',
      label: 'Mastercard',
      details: 'Business',
      lastFour: '8888',
      expiry: '09/25',
      brand: 'Mastercard',
      isDefault: false,
    },
    {
      id: '3',
      type: 'wallet',
      label: 'Ridely Wallet',
      details: 'Balance: $45.20',
      isDefault: false,
    },
    {
      id: '4',
      type: 'cash',
      label: 'Cash on Delivery',
      details: 'Pay the rider directly',
      isDefault: false,
    },
  ]);

  const setDefaultPayment = (id: string) => {
    setPaymentMethods(prev =>
      prev.map(method => ({
        ...method,
        isDefault: method.id === id,
      }))
    );
    Alert.alert('Success', 'Default payment method updated');
  };

  const removePaymentMethod = (id: string) => {
    const method = paymentMethods.find(m => m.id === id);
    
    Alert.alert(
      'Remove Payment Method',
      `Are you sure you want to remove ${method?.label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setPaymentMethods(prev => prev.filter(m => m.id !== id));
          },
        },
      ]
    );
  };

  const handlePaymentAction = (method: PaymentMethod) => {
    if (method.type === 'cash' || method.type === 'wallet') {
      return; // No actions for these types
    }

    Alert.alert(
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1F2937" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.title}>Payment Methods</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => Alert.alert('Add Payment', 'Add payment method coming soon!')}>
          <Plus size={20} color="#5A47FF" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Current Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Payment Methods</Text>
          
          {paymentMethods.map((method) => {
            const IconComponent = getPaymentIcon(method.type);
            
            return (
              <View key={method.id} style={styles.paymentCard}>
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
                    <Text style={styles.paymentLabel}>{method.label}</Text>
                    {method.type === 'card' ? (
                      <Text style={styles.paymentDetails}>
                        •••• •••• •••• {method.lastFour}
                      </Text>
                    ) : (
                      <Text style={styles.paymentDetails}>{method.details}</Text>
                    )}
                    {method.expiry && (
                      <Text style={styles.expiryText}>Expires {method.expiry}</Text>
                    )}
                  </View>
                  
                  {method.type === 'card' && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handlePaymentAction(method)}>
                      <MoreVertical size={20} color="#6B7280" strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Add New Payment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add New Payment Method</Text>
          
          <TouchableOpacity
            style={styles.addPaymentCard}
            onPress={() => Alert.alert('Add Card', 'Add credit/debit card coming soon!')}>
            <View style={styles.addPaymentIcon}>
              <CreditCard size={24} color="#5A47FF" strokeWidth={2} />
            </View>
            <View style={styles.addPaymentInfo}>
              <Text style={styles.addPaymentTitle}>Add Credit/Debit Card</Text>
              <Text style={styles.addPaymentSubtitle}>Visa, Mastercard, American Express</Text>
            </View>
            <Plus size={20} color="#5A47FF" strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addPaymentCard}
            onPress={() => Alert.alert('Top Up', 'Wallet top-up coming soon!')}>
            <View style={styles.addPaymentIcon}>
              <Wallet size={24} color="#10B981" strokeWidth={2} />
            </View>
            <View style={styles.addPaymentInfo}>
              <Text style={styles.addPaymentTitle}>Top Up Wallet</Text>
              <Text style={styles.addPaymentSubtitle}>Add money to your Ridely wallet</Text>
            </View>
            <Plus size={20} color="#10B981" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Payment Security */}
        <View style={styles.section}>
          <View style={styles.securityCard}>
            <Text style={styles.securityTitle}>🔒 Payment Security</Text>
            <Text style={styles.securityText}>
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F2FF',
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
    color: '#1F2937',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
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
    color: '#1F2937',
    marginBottom: 4,
  },
  paymentDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  expiryText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPaymentCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  addPaymentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
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
    color: '#1F2937',
    marginBottom: 4,
  },
  addPaymentSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  securityCard: {
    backgroundColor: '#F0F9FF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#0EA5E9',
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C4A6E',
    marginBottom: 12,
  },
  securityText: {
    fontSize: 14,
    color: '#0C4A6E',
    lineHeight: 20,
  },
});
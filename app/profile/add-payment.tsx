import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, CreditCard, DollarSign, Wallet, Check } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { supabase } from '@/lib/supabase';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';

export default function AddPaymentScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { methods, refetch } = usePaymentMethods();
  const hasCashOnDelivery = methods.some(m => m.type === 'cash' && m.label === 'Cash on Delivery');

  const addCashOnDelivery = async () => {
    if (!user?.id) return;
    if (hasCashOnDelivery) {
      showAlert('Already added', 'Cash on Delivery is already in your payment methods.');
      return;
    }
    try {
      // payment_methods may not be in generated types yet
      const { error } = await (supabase as any)
        .from('payment_methods')
        .insert({
          user_id: user.id,
          type: 'cash',
          label: 'Cash on Delivery',
          is_default: methods.length === 0,
        });
      if (error) throw error;
      await refetch();
      showAlert('Added', 'Cash on Delivery added to your payment methods.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      showAlert(
        'Error',
        'Could not add. Make sure the payment_methods table exists (run the migration).'
      );
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, {
        backgroundColor: theme.colors.surface,
        borderBottomColor: theme.colors.border,
        paddingTop: 16 + insets.top,
      }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDark ? theme.colors.card : '#F3F4F6' }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Add Payment Method</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Choose method</Text>

          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => router.push('/profile/add-card')}
          >
            <View style={[styles.optionIcon, { backgroundColor: isDark ? theme.colors.card : '#F0F2FF' }]}>
              <CreditCard size={24} color="#5A47FF" strokeWidth={2} />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: theme.colors.text }]}>Credit / Debit Card</Text>
              <Text style={[styles.optionSubtitle, { color: theme.colors.textSecondary }]}>
                Visa, Mastercard, American Express
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                opacity: hasCashOnDelivery ? 0.6 : 1,
              },
            ]}
            onPress={addCashOnDelivery}
            disabled={hasCashOnDelivery}
          >
            <View style={[styles.optionIcon, { backgroundColor: isDark ? theme.colors.card : '#ECFDF5' }]}>
              <DollarSign size={24} color="#10B981" strokeWidth={2} />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: theme.colors.text }]}>Cash on Delivery</Text>
              <Text style={[styles.optionSubtitle, { color: theme.colors.textSecondary }]}>
                {hasCashOnDelivery
                  ? 'Already in your payment methods'
                  : 'Pay the rider when the package is delivered'}
              </Text>
            </View>
            {hasCashOnDelivery && (
              <View style={[styles.addedBadge, { backgroundColor: theme.colors.success }]}>
                <Check size={16} color="#FFFFFF" strokeWidth={2} />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => router.push('/profile/fund-wallet')}
          >
            <View style={[styles.optionIcon, { backgroundColor: isDark ? theme.colors.card : '#F3F4F6' }]}>
              <Wallet size={24} color={theme.colors.primary} strokeWidth={2} />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: theme.colors.text }]}>Ridely Wallet</Text>
              <Text style={[styles.optionSubtitle, { color: theme.colors.textSecondary }]}>
                Add money and pay from balance
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
  title: { fontSize: 20, fontWeight: '700' },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  section: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionInfo: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  optionSubtitle: { fontSize: 14 },
  addedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

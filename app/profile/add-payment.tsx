import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '@/components/Text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, CreditCard, Wallet } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function AddPaymentScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

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

          {/* Cash on Delivery is retired for new bookings — existing rows stay
              visible under Payment Methods for history. */}

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
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '700' },
  placeholder: { width: 44 },
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

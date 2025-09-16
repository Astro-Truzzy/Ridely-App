import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { ArrowLeft, DollarSign, TrendingUp, Calendar, Download, CreditCard, Clock, CircleCheck as CheckCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

interface EarningsData {
  totalBalance: number;
  todayEarnings: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
  completedDeliveries: number;
  pendingPayouts: number;
}

interface DeliveryEarning {
  id: string;
  date: string;
  time: string;
  deliveryId: string;
  grossAmount: number;
  ridelyFee: number;
  netAmount: number;
  status: 'completed' | 'pending' | 'paid';
  pickupAddress: string;
  dropoffAddress: string;
}

export default function EarningsScreen() {
  const { theme } = useTheme();
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  
  const [earningsData] = useState<EarningsData>({
    totalBalance: 1247.85,
    todayEarnings: 156.75,
    weeklyEarnings: 892.40,
    monthlyEarnings: 3456.20,
    completedDeliveries: 47,
    pendingPayouts: 156.75,
  });

  const [deliveryEarnings] = useState<DeliveryEarning[]>([
    {
      id: '1',
      date: 'Today',
      time: '3:45 PM',
      deliveryId: 'DEL001',
      grossAmount: 18.50,
      ridelyFee: 2.78, // 15%
      netAmount: 15.72,
      status: 'completed',
      pickupAddress: '123 Main St',
      dropoffAddress: '456 Oak Ave',
    },
    {
      id: '2',
      date: 'Today',
      time: '2:15 PM',
      deliveryId: 'DEL002',
      grossAmount: 24.75,
      ridelyFee: 3.71,
      netAmount: 21.04,
      status: 'completed',
      pickupAddress: 'City Mall',
      dropoffAddress: 'Office Complex',
    },
    {
      id: '3',
      date: 'Today',
      time: '11:30 AM',
      deliveryId: 'DEL003',
      grossAmount: 12.25,
      ridelyFee: 1.84,
      netAmount: 10.41,
      status: 'pending',
      pickupAddress: 'Restaurant',
      dropoffAddress: 'Apartment',
    },
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} color={theme.colors.success} strokeWidth={2} />;
      case 'pending':
        return <Clock size={16} color={theme.colors.warning} strokeWidth={2} />;
      case 'paid':
        return <CreditCard size={16} color={theme.colors.primary} strokeWidth={2} />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return theme.colors.success;
      case 'pending':
        return theme.colors.warning;
      case 'paid':
        return theme.colors.primary;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getCurrentEarnings = () => {
    switch (selectedPeriod) {
      case 'today':
        return earningsData.todayEarnings;
      case 'week':
        return earningsData.weeklyEarnings;
      case 'month':
        return earningsData.monthlyEarnings;
      default:
        return earningsData.todayEarnings;
    }
  };

  const handleRequestPayout = () => {
    Alert.alert(
      'Request Payout',
      `Request payout of $${earningsData.pendingPayouts}?\n\nFunds will be transferred to your registered bank account within 1-2 business days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Payout',
          onPress: () => {
            Alert.alert('Success', 'Payout request submitted successfully!');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Earnings</Text>
        <TouchableOpacity
          style={[styles.downloadButton, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}
          onPress={() => Alert.alert('Export', 'Earnings report export coming soon!')}>
          <Download size={20} color={theme.colors.primary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: theme.colors.primary }, theme.shadows.large]}>
          <View style={styles.balanceHeader}>
            <DollarSign size={32} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.balanceLabel}>Total Balance</Text>
          </View>
          <Text style={styles.balanceAmount}>${earningsData.totalBalance}</Text>
          <Text style={styles.balanceSubtext}>
            {earningsData.completedDeliveries} deliveries completed
          </Text>
          
          <TouchableOpacity
            style={styles.payoutButton}
            onPress={handleRequestPayout}>
            <CreditCard size={20} color={theme.colors.primary} strokeWidth={2} />
            <Text style={[styles.payoutText, { color: theme.colors.primary }]}>
              Request Payout ($${earningsData.pendingPayouts})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Period Selector */}
        <View style={styles.periodContainer}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Earnings Overview</Text>
          <View style={[styles.periodSelector, { backgroundColor: theme.colors.surface }]}>
            {(['today', 'week', 'month'] as const).map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.periodButton,
                  selectedPeriod === period && { backgroundColor: theme.colors.primary },
                ]}
                onPress={() => setSelectedPeriod(period)}>
                <Text
                  style={[
                    styles.periodText,
                    { color: selectedPeriod === period ? '#FFFFFF' : theme.colors.textSecondary },
                  ]}>
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Earnings Stats */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
            <TrendingUp size={24} color={theme.colors.success} strokeWidth={2} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              ${getCurrentEarnings()}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              {selectedPeriod === 'today' ? 'Today' : selectedPeriod === 'week' ? 'This Week' : 'This Month'}
            </Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
            <Calendar size={24} color={theme.colors.primary} strokeWidth={2} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {selectedPeriod === 'today' ? '8' : selectedPeriod === 'week' ? '42' : '156'}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Deliveries</Text>
          </View>
        </View>

        {/* Recent Earnings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Deliveries</Text>
          
          {deliveryEarnings.map((earning) => (
            <View key={earning.id} style={[styles.earningCard, { backgroundColor: theme.colors.surface }, theme.shadows.small]}>
              <View style={styles.earningHeader}>
                <View style={styles.earningInfo}>
                  <Text style={[styles.deliveryId, { color: theme.colors.text }]}>#{earning.deliveryId}</Text>
                  <Text style={[styles.earningTime, { color: theme.colors.textSecondary }]}>
                    {earning.date} • {earning.time}
                  </Text>
                </View>
                <View style={styles.statusContainer}>
                  {getStatusIcon(earning.status)}
                  <Text style={[styles.statusText, { color: getStatusColor(earning.status) }]}>
                    {earning.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.addressInfo}>
                <Text style={[styles.addressText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {earning.pickupAddress} → {earning.dropoffAddress}
                </Text>
              </View>

              <View style={styles.earningBreakdown}>
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: theme.colors.textSecondary }]}>Gross Amount</Text>
                  <Text style={[styles.breakdownValue, { color: theme.colors.text }]}>${earning.grossAmount}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: theme.colors.textSecondary }]}>Ridely Fee (15%)</Text>
                  <Text style={[styles.breakdownValue, { color: theme.colors.error }]}>-${earning.ridelyFee}</Text>
                </View>
                <View style={[styles.breakdownRow, styles.totalRow]}>
                  <Text style={[styles.breakdownTotal, { color: theme.colors.text }]}>Net Earnings</Text>
                  <Text style={[styles.breakdownTotalValue, { color: theme.colors.success }]}>${earning.netAmount}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Payout Info */}
        <View style={[styles.payoutInfo, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
          <Text style={[styles.payoutTitle, { color: theme.colors.text }]}>💡 Payout Information</Text>
          <Text style={[styles.payoutText, { color: theme.colors.textSecondary }]}>
            • Ridely automatically deducts 15% from each completed delivery{'\n'}
            • Payouts are processed within 1-2 business days{'\n'}
            • Minimum payout amount is $50{'\n'}
            • All earnings are tracked and reported for tax purposes
          </Text>
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
  downloadButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  balanceCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 12,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  balanceSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 20,
  },
  payoutButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  periodContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  periodSelector: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  earningCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  earningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  earningInfo: {
    flex: 1,
  },
  deliveryId: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  earningTime: {
    fontSize: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  addressInfo: {
    marginBottom: 16,
  },
  addressText: {
    fontSize: 14,
  },
  earningBreakdown: {
    gap: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  breakdownLabel: {
    fontSize: 14,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  breakdownTotal: {
    fontSize: 14,
    fontWeight: '700',
  },
  breakdownTotalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  payoutInfo: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  payoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  payoutText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
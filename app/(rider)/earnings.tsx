import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated from 'react-native-reanimated';
import { ArrowLeft, DollarSign, TrendingUp, Calendar, Download, CreditCard, Clock, CircleCheck as CheckCircle, PackageOpen } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { useAlert } from '@/contexts/AlertContext';
import { useEarnings } from '@/hooks/useEarnings';
import { Skeleton, CardSkeletonList } from '@/components/Skeleton';
import { staggeredCardEnter, cardEnterSpring } from '@/lib/riderAnimations';
import { AnimatedPressable } from '@/components/rider/AnimatedPressable';

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

const formatNaira = (amount: number) =>
  `₦${Number(amount || 0).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function EarningsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { showAlert } = useAlert();
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [refreshing, setRefreshing] = useState(false);
  const { animations: animationsEnabled } = useAppSettings();
  const enterCard = (i: number) => (animationsEnabled ? staggeredCardEnter(i) : undefined);
  const enterHero = animationsEnabled ? cardEnterSpring() : undefined;

  const {
    earnings,
    totalBalance,
    todayEarnings,
    weeklyEarnings,
    monthlyEarnings,
    loading,
    refetch,
  } = useEarnings();

  const completedDeliveries = earnings.length;
  const pendingPayouts = useMemo(
    () =>
      earnings
        .filter((e) => e.status !== 'paid')
        .reduce((sum, e) => sum + Number(e.net_amount || 0), 0),
    [earnings]
  );

  const deliveryEarnings = useMemo<DeliveryEarning[]>(() => {
    return earnings.map((e) => {
      const created = new Date(e.created_at);
      const isToday = e.created_at.startsWith(new Date().toISOString().split('T')[0]);
      return {
        id: e.id,
        date: isToday
          ? 'Today'
          : created.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        time: created.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        deliveryId: e.delivery_id ? e.delivery_id.slice(0, 8).toUpperCase() : '—',
        grossAmount: Number(e.gross_amount || 0),
        ridelyFee: Number(e.ridely_fee || 0),
        netAmount: Number(e.net_amount || 0),
        status: e.status,
        pickupAddress: e.deliveries?.pickup_address ?? 'Pickup',
        dropoffAddress: e.deliveries?.dropoff_address ?? 'Dropoff',
      };
    });
  }, [earnings]);

  const deliveriesInPeriod = useMemo(() => {
    const now = Date.now();
    if (selectedPeriod === 'today') {
      const today = new Date().toISOString().split('T')[0];
      return earnings.filter((e) => e.created_at.startsWith(today)).length;
    }
    const days = selectedPeriod === 'week' ? 7 : 30;
    const cutoff = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
    return earnings.filter((e) => e.created_at >= cutoff).length;
  }, [earnings, selectedPeriod]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

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
        return todayEarnings;
      case 'week':
        return weeklyEarnings;
      case 'month':
        return monthlyEarnings;
      default:
        return todayEarnings;
    }
  };

  const handleRequestPayout = () => {
    if (pendingPayouts < 50) {
      showAlert('No funds to withdraw', 'You need at least ₦50 in pending earnings to request a payout.');
      return;
    }
    router.push('/(rider)/payout');
  };

  const buildCsv = () => {
    const header = [
      'Delivery ID',
      'Date',
      'Time',
      'Pickup Address',
      'Dropoff Address',
      'Gross Amount',
      'Ridely Fee',
      'Net Amount',
      'Status',
    ];
    const rows = deliveryEarnings.map((item) => [
      item.deliveryId,
      item.date,
      item.time,
      item.pickupAddress,
      item.dropoffAddress,
      item.grossAmount.toFixed(2),
      item.ridelyFee.toFixed(2),
      item.netAmount.toFixed(2),
      item.status,
    ]);
    const allRows = [header, ...rows];
    return allRows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');
  };

  const handleExportReport = async () => {
    try {
      const csv = buildCsv();
      const dir = FileSystem.cacheDirectory;
      if (!dir) {
        showAlert('Export failed', 'Storage is unavailable on this device.');
        return;
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileUri = `${dir}ridely-earnings-${timestamp}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Share earnings report',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        showAlert('Export complete', `Report saved to:\n${fileUri}`);
      }
    } catch (e) {
      showAlert('Export failed', e instanceof Error ? e.message : 'Unable to export report.');
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Header */}
      <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
        <AnimatedPressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.colors.text }]}>Earnings</Text>
        <AnimatedPressable
          style={[styles.downloadButton, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}
          onPress={handleExportReport}
        >
          <Download size={20} color={theme.colors.primary} strokeWidth={2} />
        </AnimatedPressable>
      </View>

      {loading && earnings.length === 0 ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <Skeleton width="100%" height={160} radius={20} style={{ marginBottom: 24 }} />
          <Skeleton width="100%" height={48} radius={12} style={{ marginBottom: 24 }} />
          <CardSkeletonList count={3} />
        </View>
      ) : (
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Balance Card */}
        <Animated.View entering={enterHero} style={[styles.balanceCard, { backgroundColor: theme.colors.primary }, theme.shadows.large]}>
          <View style={styles.balanceHeader}>
            <DollarSign size={32} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.balanceLabel}>Total Balance</Text>
          </View>
          <Text style={styles.balanceAmount}>{formatNaira(totalBalance)}</Text>
          <Text style={styles.balanceSubtext}>
            {completedDeliveries} {completedDeliveries === 1 ? 'delivery' : 'deliveries'} completed
          </Text>
          
          <AnimatedPressable
            style={styles.payoutButton}
            onPress={handleRequestPayout}
          >
            <CreditCard size={20} color={theme.colors.primary} strokeWidth={2} />
            <Text style={[styles.payoutText, { color: theme.colors.primary }]}>
              Request Payout ({formatNaira(pendingPayouts)})
            </Text>
          </AnimatedPressable>
        </Animated.View>

        {/* Period Selector */}
        <Animated.View entering={enterCard(0)} style={styles.periodContainer}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Earnings Overview</Text>
          <View style={[styles.periodSelector, { backgroundColor: theme.colors.surface }]}>
            {(['today', 'week', 'month'] as const).map((period) => (
              <AnimatedPressable
                key={period}
                style={[
                  styles.periodButton,
                  selectedPeriod === period && { backgroundColor: theme.colors.primary },
                ]}
                onPress={() => setSelectedPeriod(period)}
              >
                <Text
                  style={[
                    styles.periodText,
                    { color: selectedPeriod === period ? '#FFFFFF' : theme.colors.textSecondary },
                  ]}>
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
        </Animated.View>

        {/* Earnings Stats */}
        <Animated.View entering={enterCard(1)} style={styles.statsContainer}>
          <Animated.View entering={enterCard(2)} style={[styles.statCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
            <TrendingUp size={24} color={theme.colors.success} strokeWidth={2} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {formatNaira(getCurrentEarnings())}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              {selectedPeriod === 'today' ? 'Today' : selectedPeriod === 'week' ? 'This Week' : 'This Month'}
            </Text>
          </Animated.View>
          
          <Animated.View entering={enterCard(3)} style={[styles.statCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
            <Calendar size={24} color={theme.colors.primary} strokeWidth={2} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {deliveriesInPeriod}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Deliveries</Text>
          </Animated.View>
        </Animated.View>

        {/* Recent Earnings */}
        <Animated.View entering={enterCard(4)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Deliveries</Text>

          {deliveryEarnings.length === 0 && (
            <View style={[styles.emptyCard, { backgroundColor: theme.colors.surface }, theme.shadows.small]}>
              <PackageOpen size={32} color={theme.colors.textTertiary} strokeWidth={1.5} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No earnings yet</Text>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                Complete your first delivery to start earning. Your payouts will show up here.
              </Text>
            </View>
          )}

          {deliveryEarnings.map((earning, index) => (
            <Animated.View key={earning.id} entering={enterCard(5 + index)} style={[styles.earningCard, { backgroundColor: theme.colors.surface }, theme.shadows.small]}>
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
                  <Text style={[styles.breakdownValue, { color: theme.colors.text }]}>{formatNaira(earning.grossAmount)}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: theme.colors.textSecondary }]}>Ridely Fee (15%)</Text>
                  <Text style={[styles.breakdownValue, { color: theme.colors.error }]}>-{formatNaira(earning.ridelyFee)}</Text>
                </View>
                <View style={[styles.breakdownRow, styles.totalRow]}>
                  <Text style={[styles.breakdownTotal, { color: theme.colors.text }]}>Net Earnings</Text>
                  <Text style={[styles.breakdownTotalValue, { color: theme.colors.success }]}>{formatNaira(earning.netAmount)}</Text>
                </View>
              </View>
            </Animated.View>
          ))}
        </Animated.View>

        {/* Payout Info */}
        <Animated.View entering={enterCard(10)} style={[styles.payoutInfo, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
          <Text style={[styles.payoutTitle, { color: theme.colors.text }]}>💡 Payout Information</Text>
          <Text style={[styles.payoutInfoText, { color: theme.colors.textSecondary }]}>
            • Ridely automatically deducts 15% from each completed delivery{'\n'}
            • Payouts are processed within 1-2 business days{'\n'}
            • Minimum payout amount is ₦50{'\n'}
            • All earnings are tracked and reported for tax purposes
          </Text>
        </Animated.View>
      </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
  payoutInfoText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
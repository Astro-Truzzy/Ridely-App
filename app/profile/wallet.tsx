import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet as WalletIcon,
  Lock,
  ChevronRight,
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useWallet } from '@/hooks/useWallet';
import { useTransactions } from '@/hooks/useTransactions';
import { useWithdrawalPin } from '@/hooks/useWithdrawalPin';
import { Skeleton, CardSkeletonList } from '@/components/Skeleton';
import {
  formatNairaAmount,
  transactionLabel,
  transactionStatusLabel,
} from '@/lib/receiptDisplay';

function formatDate(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { balance, loading: balanceLoading, refetch: refetchBalance } = useWallet();
  const { transactions, loading: txLoading, refetch: refetchTx } = useTransactions();
  const { hasPin, refetch: refetchPin } = useWithdrawalPin();
  const hasPendingActivity = useMemo(
    () =>
      transactions.some(
        (tx) =>
          (tx.category === 'wallet_withdrawal' || tx.category === 'wallet_topup') &&
          tx.status === 'pending'
      ),
    [transactions]
  );

  useFocusEffect(
    useCallback(() => {
      refetchBalance();
      refetchTx();
      refetchPin();
    }, [refetchBalance, refetchTx, refetchPin])
  );

  const onRefresh = useCallback(() => {
    refetchBalance();
    refetchTx();
  }, [refetchBalance, refetchTx]);

  useEffect(() => {
    if (!hasPendingActivity) return;
    const interval = setInterval(() => {
      refetchBalance();
      refetchTx();
    }, 8000);
    return () => clearInterval(interval);
  }, [hasPendingActivity, refetchBalance, refetchTx]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.border,
            paddingTop: 16 + insets.top,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDark ? theme.colors.card : '#F3F4F6' }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>My Wallet</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={balanceLoading || txLoading} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* Balance card */}
        <View style={[styles.balanceCard, { backgroundColor: theme.colors.primary }]}>
          <View style={styles.balanceHeader}>
            <WalletIcon size={22} color="rgba(255,255,255,0.9)" strokeWidth={2} />
            <Text style={styles.balanceLabel}>Available balance</Text>
          </View>
          {balanceLoading && balance === null ? (
            <Skeleton width={180} height={40} radius={8} style={{ marginTop: 12, backgroundColor: 'rgba(255,255,255,0.35)' }} />
          ) : (
            <Text style={styles.balanceValue}>{formatNairaAmount(balance ?? 0)}</Text>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.surface }, theme.shadows.small]}
            onPress={() => router.push('/profile/fund-wallet')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#10B981' }]}>
              <Plus size={22} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <Text style={[styles.actionText, { color: theme.colors.text }]}>Fund wallet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.surface }, theme.shadows.small]}
            onPress={() => router.push('/profile/withdraw')}
          >
            <View style={[styles.actionIcon, { backgroundColor: theme.colors.primary }]}>
              <ArrowUpRight size={22} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <Text style={[styles.actionText, { color: theme.colors.text }]}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.pinRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => router.push('/profile/withdrawal-pin')}
        >
          <View style={[styles.pinIcon, { backgroundColor: `${theme.colors.primary}15` }]}>
            <Lock size={18} color={theme.colors.primary} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pinTitle, { color: theme.colors.text }]}>Withdrawal PIN</Text>
            <Text style={[styles.pinSubtitle, { color: theme.colors.textSecondary }]}>
              {hasPin ? 'PIN is set' : 'Set a 4-digit PIN for withdrawals'}
            </Text>
          </View>
        </TouchableOpacity>

        {hasPendingActivity ? (
          <View style={[styles.pendingNotice, { backgroundColor: isDark ? '#2F2A14' : '#FFF8DB', borderColor: isDark ? '#4A421A' : '#F1E5A5' }]}>
            <Text style={[styles.pendingNoticeText, { color: isDark ? '#FDE68A' : '#8A6D1F' }]}>
              Some wallet transactions are processing. This page refreshes automatically.
            </Text>
          </View>
        ) : null}

        {/* Transactions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Activity</Text>

          {txLoading && transactions.length === 0 ? (
            <CardSkeletonList count={4} />
          ) : transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <WalletIcon size={40} color={theme.colors.textTertiary} strokeWidth={1.5} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                No transactions yet
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.textTertiary }]}>
                Fund your wallet to get started
              </Text>
            </View>
          ) : (
            transactions.map((tx) => {
              const isCredit = tx.type === 'credit';
              return (
                <TouchableOpacity
                  key={tx.id}
                  activeOpacity={0.7}
                  onPress={() => router.push({ pathname: '/profile/receipt', params: { id: tx.id } })}
                  style={[styles.txRow, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}
                >
                  <View
                    style={[
                      styles.txIcon,
                      { backgroundColor: isCredit ? '#10B98120' : `${theme.colors.error}20` },
                    ]}
                  >
                    {isCredit ? (
                      <ArrowDownLeft size={20} color="#10B981" strokeWidth={2} />
                    ) : (
                      <ArrowUpRight size={20} color={theme.colors.error} strokeWidth={2} />
                    )}
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={[styles.txLabel, { color: theme.colors.text }]}>
                      {transactionLabel(tx)}
                    </Text>
                    <Text style={[styles.txStatus, { color: theme.colors.textSecondary }]}>
                      {transactionStatusLabel(tx)}
                    </Text>
                    <Text style={[styles.txDate, { color: theme.colors.textTertiary }]}>
                      {formatDate(tx.created_at)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      { color: isCredit ? '#10B981' : theme.colors.error },
                    ]}
                  >
                    {isCredit ? '+' : '-'}
                    {formatNairaAmount(tx.amount)}
                  </Text>
                  <ChevronRight size={18} color={theme.colors.textTertiary} strokeWidth={2} />
                </TouchableOpacity>
              );
            })
          )}
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
  balanceCard: {
    margin: 20,
    borderRadius: 20,
    padding: 24,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
  },
  balanceValue: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    marginTop: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: { fontSize: 14, fontWeight: '600' },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  pinIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTitle: { fontSize: 15, fontWeight: '600' },
  pinSubtitle: { fontSize: 12, marginTop: 2 },
  section: {
    padding: 20,
    paddingTop: 24,
  },
  pendingNotice: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pendingNoticeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySubtext: { fontSize: 14 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 15, fontWeight: '600' },
  txStatus: { fontSize: 12, marginTop: 2 },
  txDate: { fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '700' },
});

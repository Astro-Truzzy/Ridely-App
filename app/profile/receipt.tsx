import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Share2 } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { WalletTransaction } from '@/hooks/useTransactions';
import {
  formatNairaAmount,
  transactionLabel,
  transactionMethod,
  transactionReference,
  transactionStatusLabel,
} from '@/lib/receiptDisplay';

function paramId(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value) return value;
  if (Array.isArray(value) && value[0]) return value[0];
  return null;
}

function formatDate(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function WalletReceiptScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const transactionId = paramId(id);

  const query = useQuery({
    queryKey: ['transaction', user?.id, transactionId],
    enabled: !!user?.id && !!transactionId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('transactions')
        .select('id, amount, type, category, provider, provider_reference, metadata, reference, status, created_at')
        .eq('id', transactionId)
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as WalletTransaction | null;
    },
  });

  const tx = query.data ?? null;
  const isCredit = tx?.type === 'credit';
  const reference = tx ? transactionReference(tx) : '';

  const handleShare = useCallback(async () => {
    if (!tx) return;
    const signed = isCredit ? '+' : '-';
    await Share.share({
      message: [
        `${transactionLabel(tx)}`,
        `Amount: ${signed}${formatNairaAmount(tx.amount)}`,
        `Status: ${transactionStatusLabel(tx)}`,
        `Method: ${transactionMethod(tx)}`,
        `Reference: ${reference}`,
        `Date: ${formatDate(tx.created_at)}`,
      ].join('\n'),
    });
  }, [tx, isCredit, reference]);

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
            backgroundColor: theme.colors.card,
            borderBottomColor: theme.colors.border,
            paddingTop: 16 + insets.top,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDark ? theme.colors.surface : '#F3F4F6' }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Receipt</Text>
        {tx ? (
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: isDark ? theme.colors.surface : '#F3F4F6' }]}
            onPress={handleShare}
          >
            <Share2 size={20} color={theme.colors.text} strokeWidth={2} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {query.isLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : !tx ? (
          <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
            Receipt not found.
          </Text>
        ) : (
          <>
            <Text style={[styles.kind, { color: theme.colors.textSecondary }]}>
              {transactionLabel(tx)}
            </Text>
            <Text
              style={[
                styles.amount,
                { color: isCredit ? '#10B981' : theme.colors.error },
              ]}
            >
              {isCredit ? '+' : '-'}
              {formatNairaAmount(tx.amount)}
            </Text>

            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Row label="Status" value={transactionStatusLabel(tx)} theme={theme} />
              <Row label="Method" value={transactionMethod(tx)} theme={theme} />
              <Row label="Reference" value={reference} theme={theme} mono />
              <Row label="Date" value={formatDate(tx.created_at)} theme={theme} last />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  theme,
  last,
  mono,
}: {
  label: string;
  value: string;
  theme: { colors: { text: string; textSecondary: string; border: string } };
  last?: boolean;
  mono?: boolean;
}) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }]}>
      <Text style={[styles.rowLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text
        selectable
        style={[styles.rowValue, { color: theme.colors.text }, mono && styles.mono]}
      >
        {value}
      </Text>
    </View>
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
  body: { padding: 24 },
  kind: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  amount: { fontSize: 36, fontWeight: '800', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { paddingHorizontal: 16, paddingVertical: 14 },
  rowLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  rowValue: { fontSize: 15, fontWeight: '600' },
  mono: { fontSize: 13, fontWeight: '500' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 15 },
});

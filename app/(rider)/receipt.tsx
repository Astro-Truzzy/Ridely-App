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
import { formatNairaAmount } from '@/lib/receiptDisplay';

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

function earningStatusLabel(status: string): string {
  if (status === 'paid') return 'Paid out';
  if (status === 'completed') return 'Available';
  if (status === 'pending') return 'Pending';
  return status || 'Unknown';
}

function earningMethod(status: string): string {
  return status === 'paid' ? 'Bank transfer' : 'Delivery earnings';
}

export default function RiderReceiptScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const earningId = paramId(id);

  const query = useQuery({
    queryKey: ['earning-receipt', user?.id, earningId],
    enabled: !!user?.id && !!earningId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('earnings')
        .select('id, delivery_id, gross_amount, ridely_fee, net_amount, status, created_at')
        .eq('id', earningId)
        .eq('rider_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        delivery_id: string | null;
        gross_amount: number;
        ridely_fee: number;
        net_amount: number;
        status: string;
        created_at: string;
      } | null;
    },
  });

  const earning = query.data ?? null;
  const reference = earning?.delivery_id || earning?.id || '';

  const handleShare = useCallback(async () => {
    if (!earning) return;
    await Share.share({
      message: [
        'Delivery earnings',
        `Amount: ${formatNairaAmount(earning.net_amount)}`,
        `Status: ${earningStatusLabel(earning.status)}`,
        `Method: ${earningMethod(earning.status)}`,
        `Reference: ${reference}`,
        `Date: ${formatDate(earning.created_at)}`,
      ].join('\n'),
    });
  }, [earning, reference]);

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
        {earning ? (
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
        ) : !earning ? (
          <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
            Receipt not found.
          </Text>
        ) : (
          <>
            <Text style={[styles.kind, { color: theme.colors.textSecondary }]}>You earned</Text>
            <Text style={[styles.amount, { color: '#10B981' }]}>
              {formatNairaAmount(earning.net_amount)}
            </Text>

            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Row label="Status" value={earningStatusLabel(earning.status)} theme={theme} />
              <Row label="Method" value={earningMethod(earning.status)} theme={theme} />
              <Row label="Reference" value={reference} theme={theme} mono />
              <Row label="Gross" value={formatNairaAmount(earning.gross_amount)} theme={theme} />
              <Row label="Ridely fee" value={`-${formatNairaAmount(earning.ridely_fee)}`} theme={theme} />
              <Row label="Date" value={formatDate(earning.created_at)} theme={theme} last />
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

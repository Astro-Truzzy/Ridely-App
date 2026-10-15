import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Text } from '@/components/Text';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useIsAdmin } from '@/hooks/useIsAdmin';

const koboToNaira = (kobo: number) =>
  `₦${(Number(kobo || 0) / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

interface BatchDetail {
  batch: {
    id: string;
    slot: string;
    lagos_business_date: string;
    status: string;
    eligible_rider_count: number;
    total_amount_kobo: number;
    paid_amount_kobo: number;
    failed_amount_kobo: number;
    scheduled_at: string;
    completed_at: string | null;
    error: string | null;
  };
  payouts: {
    id: string;
    rider_id: string;
    amount: number;
    amount_kobo: number | null;
    status: string;
    failure_reason: string | null;
    reference: string;
    transfer_code: string | null;
    created_at: string;
    updated_at: string;
  }[];
}

/** Per-batch drill-down: every rider payout with provider refs and status. */
export default function AdminBatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('You must be logged in.');
      const { data, error: fnError } = await supabase.functions.invoke('admin-finance', {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: { action: 'batch', batch_id: id },
      });
      if (fnError) throw new Error(fnError.message || 'Could not load batch');
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setDetail(data as BatchDetail);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load batch');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!adminLoading && isAdmin) fetchDetail();
  }, [adminLoading, isAdmin, fetchDetail]);

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
          style={[
            styles.backButton,
            { backgroundColor: isDark ? theme.colors.card : '#F3F4F6' },
          ]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Batch detail
        </Text>
        <View style={styles.placeholder} />
      </View>

      {adminLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : !isAdmin ? (
        <View style={styles.center}>
          <Text style={[styles.denied, { color: theme.colors.text }]}>
            Admin access required.
          </Text>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.denied, { color: theme.colors.error }]}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={[styles.batchTitle, { color: theme.colors.text }]}>
            {detail?.batch.lagos_business_date} · {detail?.batch.slot} WAT
          </Text>
          <Text style={[styles.batchMeta, { color: theme.colors.textSecondary }]}>
            Status: {detail?.batch.status} · {(detail?.payouts ?? []).length} payouts
          </Text>
          <Text style={[styles.batchMeta, { color: theme.colors.textSecondary }]}>
            Total {koboToNaira(detail?.batch.total_amount_kobo ?? 0)} · Paid{' '}
            {koboToNaira(detail?.batch.paid_amount_kobo ?? 0)} · Failed{' '}
            {koboToNaira(detail?.batch.failed_amount_kobo ?? 0)}
          </Text>
          {(detail?.payouts ?? []).map((p) => (
            <View
              key={p.id}
              style={[
                styles.card,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.batchTitle, { color: theme.colors.text }]}>
                {koboToNaira(p.amount_kobo ?? Math.round(Number(p.amount || 0) * 100))}
              </Text>
              <Text style={[styles.batchMeta, { color: theme.colors.textSecondary }]}>
                {p.status} · ref {p.reference}
              </Text>
              {p.transfer_code ? (
                <Text style={[styles.batchMeta, { color: theme.colors.textSecondary }]}>
                  Provider: {p.transfer_code}
                </Text>
              ) : null}
              {p.failure_reason ? (
                <Text style={[styles.batchMeta, { color: theme.colors.error }]}>
                  {p.failure_reason}
                </Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  denied: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  batchTitle: { fontSize: 16, fontWeight: '700' },
  batchMeta: { fontSize: 13, marginTop: 2 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 10,
  },
});

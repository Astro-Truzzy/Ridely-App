import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Text } from '@/components/Text';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ChevronRight, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useIsAdmin } from '@/hooks/useIsAdmin';

const koboToNaira = (kobo: number) =>
  `₦${(Number(kobo || 0) / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

interface Overview {
  ledger_totals_kobo: Record<string, number>;
  payments_by_status: Record<string, { count: number; kobo: number }>;
  batches: BatchSummary[];
  attention: {
    payments: AttentionPayment[];
    payouts: AttentionPayout[];
  };
}

interface BatchSummary {
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
}

interface AttentionPayment {
  reference: string;
  status: string;
  method: string;
  expected_amount_kobo: number;
  failure_reason: string | null;
  created_at: string;
}

interface AttentionPayout {
  reference: string;
  rider_id: string;
  amount: number;
  status: string;
  failure_reason: string | null;
  batch_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Admin finance dashboard (read-only). Every number comes from the ledger via
 * the admin-finance edge function, which re-checks users.is_admin server-side.
 * No amounts can be edited here: failed payouts release automatically for the
 * next run and pending transfers settle only via the verified webhook.
 */
export default function AdminFinanceScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('You must be logged in.');
      const { data, error: fnError } = await supabase.functions.invoke('admin-finance', {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: { action: 'overview' },
      });
      if (fnError) throw new Error(fnError.message || 'Could not load finance overview');
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setOverview(data as Overview);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load finance overview');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!adminLoading && isAdmin) fetchOverview();
  }, [adminLoading, isAdmin, fetchOverview]);

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
          Finance
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
          <Text style={[styles.denied, { color: theme.colors.error }]}>
            {error}
          </Text>
          <TouchableOpacity onPress={() => { setLoading(true); fetchOverview(); }}>
            <Text style={{ color: theme.colors.primary, marginTop: 12 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchOverview();
              }}
            />
          }
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Ledger totals
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <TotalRow theme={theme} label="Collected from customers" value={koboToNaira(overview?.ledger_totals_kobo.collection ?? 0)} />
            <TotalRow theme={theme} label="Commission earned" value={koboToNaira(overview?.ledger_totals_kobo.commission_earned ?? 0)} />
            <TotalRow theme={theme} label="Rider earnings accrued" value={koboToNaira(-(overview?.ledger_totals_kobo.rider_accrued ?? 0))} />
            <TotalRow theme={theme} label="Paid out to riders" value={koboToNaira(-(overview?.ledger_totals_kobo.payout ?? 0))} />
            <TotalRow theme={theme} label="Refunds / reversals" value={koboToNaira((overview?.ledger_totals_kobo.refund ?? 0) + (overview?.ledger_totals_kobo.payout_reversal ?? 0))} />
          </View>

          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Settlement batches
          </Text>
          {(overview?.batches ?? []).length === 0 ? (
            <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
              No settlement runs yet.
            </Text>
          ) : (
            (overview?.batches ?? []).map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[
                  styles.card,
                  styles.batchRow,
                  { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                ]}
                onPress={() => router.push({ pathname: '/admin/batch', params: { id: b.id } })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.batchTitle, { color: theme.colors.text }]}>
                    {b.lagos_business_date} · {b.slot} WAT
                  </Text>
                  <Text style={[styles.batchMeta, { color: theme.colors.textSecondary }]}>
                    {b.eligible_rider_count} riders · {koboToNaira(b.total_amount_kobo)} · {b.status}
                  </Text>
                </View>
                <ChevronRight size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            ))
          )}

          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Needs attention
          </Text>
          {(overview?.attention.payments ?? []).length === 0 &&
          (overview?.attention.payouts ?? []).length === 0 ? (
            <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
              Nothing unmatched. Failed payouts release automatically for the
              next run; pending transfers settle via webhook only.
            </Text>
          ) : (
            <>
              {(overview?.attention.payments ?? []).map((p) => (
                <View
                  key={p.reference}
                  style={[
                    styles.card,
                    styles.attentionRow,
                    { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                  ]}
                >
                  <AlertTriangle size={18} color="#B45309" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.batchTitle, { color: theme.colors.text }]}>
                      {p.reference} · {koboToNaira(p.expected_amount_kobo)}
                    </Text>
                    <Text style={[styles.batchMeta, { color: theme.colors.textSecondary }]}>
                      Payment {p.status}
                      {p.failure_reason ? ` — ${p.failure_reason}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
              {(overview?.attention.payouts ?? []).map((p) => (
                <View
                  key={p.reference}
                  style={[
                    styles.card,
                    styles.attentionRow,
                    { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                  ]}
                >
                  <AlertTriangle size={18} color="#B45309" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.batchTitle, { color: theme.colors.text }]}>
                      {p.reference} · ₦{Number(p.amount || 0).toLocaleString('en-NG')}
                    </Text>
                    <Text style={[styles.batchMeta, { color: theme.colors.textSecondary }]}>
                      Payout {p.status}
                      {p.failure_reason ? ` — ${p.failure_reason}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function TotalRow({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.totalValue, { color: theme.colors.text }]}>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  denied: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginTop: 8, marginBottom: 12 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalLabel: { fontSize: 14 },
  totalValue: { fontSize: 15, fontWeight: '800' },
  batchRow: { flexDirection: 'row', alignItems: 'center' },
  batchTitle: { fontSize: 15, fontWeight: '700' },
  batchMeta: { fontSize: 13, marginTop: 2 },
  attentionRow: { flexDirection: 'row', alignItems: 'flex-start' },
  empty: { fontSize: 14, lineHeight: 20 },
});

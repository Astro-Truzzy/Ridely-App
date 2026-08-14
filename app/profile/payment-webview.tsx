import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { X } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useWallet } from '@/hooks/useWallet';
import { useTransactions } from '@/hooks/useTransactions';
import { consumePendingPayment, type PaymentIntent } from '@/lib/paymentWebViewState';
import { verifyPaystackTransaction } from '@/lib/paystack';
import { supabase } from '@/lib/supabase';
import { TestPaymentsBanner } from '@/components/TestPaymentsBanner';

interface PaystackAuthorization {
  authorization_code: string;
  last4: string;
  brand: string;
  exp_month: number;
  exp_year: number;
}

export default function PaymentWebViewScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useAlert();
  const { refetch: refetchPaymentMethods } = usePaymentMethods();
  const { refetch: refetchWallet } = useWallet();
  const { refetch: refetchTransactions } = useTransactions();
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const pending = consumePendingPayment();
    if (!pending) {
      setError('No payment session. Please try again from Add Card or Fund Wallet.');
      setLoading(false);
      return;
    }
    setPaymentUrl(pending.url);
    setIntent(pending.intent);
    setLoading(false);
  }, []);

  const saveCardFromVerification = useCallback(
    async (reference: string) => {
      const result = await verifyPaystackTransaction(reference);
      if (!result.success || !result.data) {
        showToast(result.error || 'Could not verify payment.', 'error');
        return;
      }
      const auth = (result.data as { authorization?: PaystackAuthorization }).authorization;
      if (!auth?.authorization_code || !auth?.last4) {
        showToast('Card details not returned. Please try again.', 'error');
        return;
      }
      const userId = user?.id;
      if (!userId) {
        showToast('You must be logged in to save a card.', 'error');
        return;
      }
      const brand = (auth.brand || 'card').toLowerCase();
      const label = `${brand.charAt(0).toUpperCase() + brand.slice(1)} •••• ${auth.last4}`;
      const { error: insertError } = await (supabase as any)
        .from('payment_methods')
        .insert({
          user_id: userId,
          type: 'card',
          label,
          last_four: auth.last4,
          brand: auth.brand || null,
          expiry_month: auth.exp_month ?? null,
          expiry_year: auth.exp_year ?? null,
          gateway_payment_method_id: auth.authorization_code,
          is_default: false,
        });
      if (insertError) {
        showToast(insertError.message || 'Could not save card.', 'error');
        return;
      }
      await refetchPaymentMethods();
      showToast('Card saved. You can use it when booking.');
      router.back();
    },
    [user?.id, refetchPaymentMethods]
  );

  const handleCallback = useCallback(
    async (reference: string) => {
      if (intent === 'add_card') {
        await saveCardFromVerification(reference);
      } else if (intent === 'fund_wallet') {
        setVerifying(true);
        let credited = false;
        for (let i = 0; i < 6; i += 1) {
          const { data } = await (supabase as any)
            .from('transactions')
            .select('id, status')
            .eq('reference', reference)
            .maybeSingle();
          if (data?.id) {
            credited = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        await refetchWallet();
        await refetchTransactions();
        setVerifying(false);
        showToast(
          credited
            ? 'Wallet credited.'
            : 'Payment received. Wallet credit is processing — pull to refresh shortly.'
        );
        router.back();
      }
    },
    [intent, saveCardFromVerification, refetchWallet, refetchTransactions]
  );

  const onNavigationStateChange = useCallback(
    async (navState: { url: string }) => {
      const url = navState?.url || '';
      if (!url.includes('/paystack-callback') || !url.includes('reference=')) return;
      const match = url.match(/reference=([^&]+)/);
      const reference = match ? decodeURIComponent(match[1]) : null;
      if (!reference) return;
      await handleCallback(reference);
    },
    [handleCallback]
  );

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !paymentUrl) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border, paddingTop: 16 + insets.top }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <X size={24} color={theme.colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>Payment</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingWrap}>
          <Text style={[styles.errorMessage, { color: theme.colors.text }]}>{error || 'Invalid payment session.'}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.colors.primary }]} onPress={handleClose}>
            <Text style={styles.retryButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border, paddingTop: 16 + insets.top }]}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <X size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {intent === 'fund_wallet' ? 'Fund wallet' : 'Add card'}
        </Text>
        <View style={styles.placeholder} />
      </View>
      <TestPaymentsBanner />
      {verifying ? (
        <View style={[styles.pendingBanner, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.pendingText, { color: theme.colors.textSecondary }]}>
            Confirming wallet credit...
          </Text>
        </View>
      ) : null}
      <WebView
        source={{ uri: paymentUrl }}
        style={styles.webview}
        onNavigationStateChange={onNavigationStateChange}
        originWhitelist={['https://*', 'http://*']}
        startInLoadingState
        renderLoading={() => (
          <View style={[styles.webviewLoading, { backgroundColor: theme.colors.background }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Opening secure payment…</Text>
          </View>
        )}
      />
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
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  placeholder: { width: 44 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { fontSize: 16, marginTop: 16, textAlign: 'center' },
  errorMessage: { fontSize: 15, marginTop: 16, textAlign: 'center', paddingHorizontal: 24 },
  retryButton: { marginTop: 24, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14 },
  retryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  webview: { flex: 1 },
  pendingBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  pendingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  webviewLoading: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

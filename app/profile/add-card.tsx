import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, CreditCard } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import {
  getPaystackCallbackPath,
  initializePaystackTransaction,
} from '@/lib/paystack';
import { setPendingPayment } from '@/lib/paymentWebViewState';

const SAVE_CARD_AMOUNT_KOBO = 10000; // ₦100 — Paystack live minimum for many merchants

function getPaymentErrorHint(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes('es256') || m.includes('jwt algorithm')) {
    return 'Your Supabase project uses ES256 JWTs. Run: node scripts/deploy-paystack-functions.mjs to redeploy Paystack functions with verify_jwt disabled.';
  }
  if (m.includes('paystack_secret_key')) {
    return 'In Supabase Dashboard → Project Settings → Edge Functions → Secrets, set PAYSTACK_SECRET_KEY to your Paystack secret key (sk_live_… or sk_test_…), then redeploy paystack-initialize.';
  }
  if (m.includes('not set') && m.includes('supabase_url')) {
    return 'Set EXPO_PUBLIC_SUPABASE_URL in .env and restart the Expo dev server.';
  }
  if (m.includes('404') || m.includes('not found') || m.includes('failed to send')) {
    return 'Deploy paystack-initialize from the Ridely-App folder: npx supabase functions deploy paystack-initialize';
  }
  if (m.includes('invalid key') || m.includes('invalid api')) {
    return 'Use your Paystack Secret Key (sk_test_… or sk_live_…), not the Public Key (pk_…).';
  }
  if (m.includes('active channel') || (m.includes('channel') && m.includes('not'))) {
    return 'Enable the Card channel in Paystack Dashboard → Settings → Preferences → Payment channels.';
  }
  if (m.includes('activate') || m.includes('dormant') || m.includes('live mode')) {
    return 'Your Paystack live account may need activation. Complete merchant setup in Paystack Dashboard or use test keys (sk_test_…) while testing.';
  }
  return null;
}

export default function AddCardScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user, userProfile } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isChannelError = useCallback((message: string) => {
    const m = (message || '').toLowerCase();
    return m.includes('active channel') || (m.includes('channel') && m.includes('not'));
  }, []);

  const startAddCard = useCallback(async () => {
    const email = user?.email || userProfile?.email || '';
    if (!email) {
      showAlert('Error', 'Your account email is required to add a card.');
      return;
    }
    setLoadError(null);
    setLoading(true);
    try {
      const callbackUrl = getPaystackCallbackPath();
      if (!callbackUrl) {
        setLoadError('Payment callback URL is not configured.');
        return;
      }
      const { authorization_url } = await initializePaystackTransaction({
        email,
        amountInKobo: SAVE_CARD_AMOUNT_KOBO,
        callbackUrl,
        channels: ['card'],
        metadata: user?.id ? { user_id: user.id, intent: 'add_card' } : undefined,
      });
      setPendingPayment(authorization_url, 'add_card');
      router.push('/profile/payment-webview');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not load payment form.';
      setLoadError(
        isChannelError(message)
          ? 'Card payments are not enabled for this account. Enable the Card channel in Paystack Dashboard → Settings → Preferences → Payment channels, then try again.'
          : message
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email, userProfile?.email, isChannelError]);

  React.useEffect(() => {
    startAddCard();
  }, []);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, {
        backgroundColor: theme.colors.card,
        borderBottomColor: theme.colors.border,
        paddingTop: 16 + insets.top,
      }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDark ? theme.colors.surface : '#F3F4F6' }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Add card</Text>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Opening secure payment…
          </Text>
        </View>
      ) : (
        <View style={styles.loadingWrap}>
          <CreditCard size={48} color={theme.colors.textTertiary} strokeWidth={2} />
          <Text style={[styles.errorMessage, { color: theme.colors.text }]}>
            {loadError || 'Could not load payment form.'}
          </Text>
          {loadError ? (
            (() => {
              const hint = getPaymentErrorHint(loadError);
              return hint ? (
                <Text style={[styles.errorHint, { color: theme.colors.textSecondary }]}>
                  {hint}
                </Text>
              ) : null;
            })()
          ) : null}
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={startAddCard}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '700' },
  placeholder: { width: 40 },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { fontSize: 16, marginTop: 16, textAlign: 'center' },
  errorMessage: { fontSize: 15, marginTop: 16, textAlign: 'center', paddingHorizontal: 24 },
  errorHint: { fontSize: 13, marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },
  retryButton: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

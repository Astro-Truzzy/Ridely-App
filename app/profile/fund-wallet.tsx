import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { getPaystackCallbackPath, initializePaystackTransaction } from '@/lib/paystack';
import { setPendingPayment } from '@/lib/paymentWebViewState';
import { supabase } from '@/lib/supabase';
import { useWallet } from '@/hooks/useWallet';

const MIN_NAIRA = 100; // ₦100 minimum
const MAX_NAIRA = 1_000_000;

export default function FundWalletScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user, userProfile } = useAuth();
  const { showAlert } = useAlert();
  const { refetch: refetchWallet } = useWallet();
  const [amount, setAmount] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const handleFund = useCallback(async () => {
    const email = user?.email || userProfile?.email || '';
    if (!email) {
      showAlert('Error', 'Your account email is required to fund your wallet.');
      return;
    }
    const naira = Number.parseFloat(amount.replace(/,/g, ''));
    if (Number.isNaN(naira) || naira < MIN_NAIRA) {
      setError(`Minimum amount is ₦${MIN_NAIRA}`);
      return;
    }
    if (naira > MAX_NAIRA) {
      setError(`Maximum amount is ₦${MAX_NAIRA.toLocaleString()}`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const callbackUrl = getPaystackCallbackPath();
      if (!callbackUrl) {
        setError('Payment callback URL is not configured.');
        setLoading(false);
        return;
      }
      const amountKobo = Math.round(naira * 100);
      const { authorization_url } = await initializePaystackTransaction({
        email,
        amountInKobo: amountKobo,
        callbackUrl,
        channels: ['card'],
        metadata: user?.id ? { user_id: user.id, intent: 'fund_wallet' } : undefined,
      });
      setPendingPayment(authorization_url, 'fund_wallet');
      router.push('/profile/payment-webview');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not start payment.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email, userProfile?.email, amount]);

  const handleRedeemPromo = useCallback(async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) {
      setPromoError('Enter a promo code');
      return;
    }
    setPromoError(null);
    setPromoLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('redeem-promo', {
        body: { code },
      });
      if (fnError) throw fnError;
      const result = data as { error?: string; message?: string; credited?: number };
      if (result?.error) {
        setPromoError(result.error);
        return;
      }
      showAlert(
        'Promo redeemed',
        result?.message ?? `₦${result?.credited ?? 0} added to your wallet`
      );
      setPromoCode('');
      await refetchWallet();
    } catch (e) {
      setPromoError(e instanceof Error ? e.message : 'Could not redeem promo code');
    } finally {
      setPromoLoading(false);
    }
  }, [promoCode, showAlert, refetchWallet]);

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
        <Text style={[styles.title, { color: theme.colors.text }]}>Fund wallet</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Enter amount (₦) to add to your wallet
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          placeholder="e.g. 5000"
          placeholderTextColor={theme.colors.textTertiary}
          value={amount}
          onChangeText={(t) => {
            setAmount(t);
            setError(null);
          }}
          keyboardType="decimal-pad"
          editable={!loading}
        />
        {error ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text> : null}
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.colors.primary },
            loading && styles.buttonDisabled,
          ]}
          onPress={handleFund}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue to payment</Text>
          )}
        </TouchableOpacity>
        <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
          Minimum ₦{MIN_NAIRA}. You will be redirected to Paystack to complete the payment.
        </Text>

        <View style={[styles.promoSection, { borderTopColor: theme.colors.border }]}>
          <Text style={[styles.promoTitle, { color: theme.colors.text }]}>Redeem promo code</Text>
          <Text style={[styles.promoSubtitle, { color: theme.colors.textSecondary }]}>
            Enter a code to add credit to your wallet
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            placeholder="e.g. RIDELY500"
            placeholderTextColor={theme.colors.textTertiary}
            value={promoCode}
            onChangeText={(t) => {
              setPromoCode(t.toUpperCase());
              setPromoError(null);
            }}
            autoCapitalize="characters"
            editable={!promoLoading}
          />
          {promoError ? (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{promoError}</Text>
          ) : null}
          <TouchableOpacity
            style={[
              styles.promoButton,
              { backgroundColor: theme.colors.success },
              promoLoading && styles.buttonDisabled,
            ]}
            onPress={handleRedeemPromo}
            disabled={promoLoading}
          >
            {promoLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Redeem code</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  content: { flex: 1, padding: 24 },
  label: { fontSize: 14, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    marginBottom: 12,
  },
  errorText: { fontSize: 14, marginBottom: 12 },
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, marginTop: 16, textAlign: 'center' },
  promoSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  promoSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  promoButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 4,
  },
});

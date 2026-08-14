import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import { useWithdrawalPin } from '@/hooks/useWithdrawalPin';
import { isValidWithdrawalPin, setWithdrawalPin } from '@/lib/withdrawalPin';

interface WithdrawalPinSetupScreenProps {
  backRoute?: string;
}

export default function WithdrawalPinSetupScreen({ backRoute }: WithdrawalPinSetupScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { showAlert } = useAlert();
  const { hasPin, loading: statusLoading, refetch } = useWithdrawalPin();

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (!isValidWithdrawalPin(pin)) {
      setError('PIN must be exactly 4 digits');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }
    if (hasPin && !isValidWithdrawalPin(currentPin)) {
      setError('Enter your current PIN');
      return;
    }

    setSubmitting(true);
    try {
      const result = await setWithdrawalPin({
        pin,
        currentPin: hasPin ? currentPin : undefined,
      });
      if (!result.success) {
        setError(result.error ?? 'Could not save PIN');
        return;
      }
      await refetch();
      showAlert('PIN saved', result.message ?? 'Your withdrawal PIN is ready to use.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save PIN');
    } finally {
      setSubmitting(false);
    }
  };

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
          onPress={() => (backRoute ? router.replace(backRoute as never) : router.back())}
        >
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Withdrawal PIN</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.iconWrap, { backgroundColor: `${theme.colors.primary}20` }]}>
            <Lock size={28} color={theme.colors.primary} strokeWidth={2} />
          </View>
          <Text style={[styles.heading, { color: theme.colors.text }]}>
            {hasPin ? 'Change withdrawal PIN' : 'Set withdrawal PIN'}
          </Text>
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            Use a 4-digit PIN to authorize wallet withdrawals and rider payouts.
          </Text>

          {statusLoading ? (
            <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />
          ) : (
            <>
              {hasPin ? (
                <>
                  <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Current PIN</Text>
                  <TextInput
                    style={[styles.input, inputStyle(theme)]}
                    value={currentPin}
                    onChangeText={(t) => {
                      setCurrentPin(t.replace(/\D/g, '').slice(0, 4));
                      setError(null);
                    }}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                    editable={!submitting}
                  />
                </>
              ) : null}

              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                {hasPin ? 'New PIN' : 'PIN'}
              </Text>
              <TextInput
                style={[styles.input, inputStyle(theme)]}
                value={pin}
                onChangeText={(t) => {
                  setPin(t.replace(/\D/g, '').slice(0, 4));
                  setError(null);
                }}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                editable={!submitting}
              />

              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Confirm PIN</Text>
              <TextInput
                style={[styles.input, inputStyle(theme)]}
                value={confirmPin}
                onChangeText={(t) => {
                  setConfirmPin(t.replace(/\D/g, '').slice(0, 4));
                  setError(null);
                }}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                editable={!submitting}
              />

              {error ? <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.colors.primary }, submitting && styles.disabled]}
                onPress={handleSave}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Save PIN</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function inputStyle(theme: { colors: { surface: string; border: string; text: string } }) {
  return {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    color: theme.colors.text,
  };
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
  content: { padding: 24 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
    fontWeight: '700',
  },
  error: { fontSize: 14, marginTop: 12 },
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    minHeight: 52,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.7 },
});

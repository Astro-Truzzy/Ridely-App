import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { isValidWithdrawalPin } from '@/lib/withdrawalPin';

interface WithdrawalPinModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (pin: string) => void;
}

export function WithdrawalPinModal({
  visible,
  title = 'Enter withdrawal PIN',
  subtitle = 'Enter your 4-digit PIN to continue',
  loading = false,
  error,
  onClose,
  onSubmit,
}: WithdrawalPinModalProps) {
  const { theme } = useTheme();
  const [pin, setPin] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setPin('');
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [visible]);

  useEffect(() => {
    if (pin.length === 4 && isValidWithdrawalPin(pin) && !loading) {
      onSubmit(pin);
    }
  }, [pin, loading, onSubmit]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>

          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            editable={!loading}
            textAlign="center"
          />

          {error ? (
            <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
          ) : null}

          {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 12 }} /> : null}

          <TouchableOpacity onPress={onClose} disabled={loading} style={styles.cancelBtn}>
            <Text style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 20,
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    fontSize: 28,
    letterSpacing: 12,
    paddingVertical: 14,
    fontWeight: '700',
  },
  error: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  cancelBtn: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 8,
  },
});

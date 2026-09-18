import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  ChevronDown,
  Search,
  X,
  CheckCircle,
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import {
  useEarnings,
  getPayoutWaitReasons,
  MIN_PAYOUT_NAIRA,
} from '@/hooks/useEarnings';
import { useWithdrawalPin } from '@/hooks/useWithdrawalPin';
import { WithdrawalPinModal } from '@/components/WithdrawalPinModal';
import {
  fetchBanks,
  resolveBankAccount,
  requestRiderPayout,
  type Bank,
} from '@/lib/paystack';

const MIN_NAIRA = MIN_PAYOUT_NAIRA;
type BankWithRenderKey = Bank & { _renderKey: string };

function createIdempotencyKey(): string {
  return `rp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function RiderPayoutScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { showAlert, showToast } = useAlert();
  const {
    availableAmount,
    inTransitAmount,
    hasBankOnFile,
    refetch: refetchEarnings,
  } = useEarnings();
  const {
    hasPin,
    loading: pinStatusLoading,
    refetch: refetchPin,
  } = useWithdrawalPin();

  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string>(createIdempotencyKey());

  const waitReasons = getPayoutWaitReasons({
    available: availableAmount,
    inTransit: inTransitAmount,
    hasPin,
    hasBankOnFile: hasBankOnFile || !!selectedBank,
  });
  const pendingBlocked =
    inTransitAmount > 0 ? 0 : waitReasons.length > 0 ? availableAmount : 0;
  const availableReady =
    pendingBlocked > 0 || inTransitAmount > 0 ? 0 : availableAmount;

  useFocusEffect(
    useCallback(() => {
      refetchPin();
      refetchEarnings();
    }, [refetchPin, refetchEarnings]),
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchBanks();
        if (mounted) setBanks(list);
      } catch (e) {
        if (mounted)
          setError(e instanceof Error ? e.message : 'Could not load banks');
      } finally {
        if (mounted) setBanksLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setAccountName(null);
    if (accountNumber.length !== 10 || !selectedBank) return;
    let cancelled = false;
    setResolving(true);
    (async () => {
      try {
        const name = await resolveBankAccount({
          accountNumber,
          bankCode: selectedBank.code,
        });
        if (!cancelled) setAccountName(name);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Could not verify account');
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountNumber, selectedBank]);

  const banksWithRenderKeys = useMemo<BankWithRenderKey[]>(() => {
    return banks.map((bank, index) => ({
      ...bank,
      _renderKey: `${bank.code}-${bank.name}-${index}`,
    }));
  }, [banks]);

  const filteredBanks = useMemo(() => {
    const q = bankSearch.trim().toLowerCase();
    if (!q) return banksWithRenderKeys;
    return banksWithRenderKeys.filter((b) => b.name.toLowerCase().includes(q));
  }, [banksWithRenderKeys, bankSearch]);

  const validateForm = (): boolean => {
    setError(null);
    if (availableAmount < MIN_NAIRA) {
      setError(`Minimum payout is ₦${MIN_NAIRA}`);
      return false;
    }
    if (!selectedBank) {
      setError('Select your bank');
      return false;
    }
    if (accountNumber.length !== 10) {
      setError('Enter a valid 10-digit account number');
      return false;
    }
    if (!accountName) {
      setError('Could not verify account name. Check the details.');
      return false;
    }
    return true;
  };

  const processPayout = async (withdrawalPin: string) => {
    setPinError(null);
    setSubmitting(true);
    try {
      const result = await requestRiderPayout({
        accountNumber,
        bankCode: selectedBank!.code,
        idempotencyKey: idempotencyKeyRef.current,
        withdrawalPin,
      });
      if (!result.success) {
        setPinError(result.error ?? 'Payout failed');
        return;
      }
      setPinModalOpen(false);
      idempotencyKeyRef.current = createIdempotencyKey();
      await refetchEarnings();
      showToast(result.message ?? 'Your payout is being processed.');
      router.back();
    } catch (e) {
      setPinError(e instanceof Error ? e.message : 'Payout failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    if (!hasPin) {
      showAlert(
        'Withdrawal PIN required',
        'Set a 4-digit PIN before requesting a payout.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Set PIN',
            onPress: () => router.push('/(rider)/withdrawal-pin'),
          },
        ],
      );
      return;
    }
    setPinError(null);
    setPinModalOpen(true);
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
          style={[
            styles.backButton,
            { backgroundColor: isDark ? theme.colors.card : '#F3F4F6' },
          ]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Request payout
        </Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.balancePill,
              {
                backgroundColor: isDark ? theme.colors.surface : '#F0F2FF',
                flexDirection: 'column',
                alignItems: 'stretch',
              },
            ]}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <Text
                style={[
                  styles.balancePillLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Available
              </Text>
              <Text
                style={[styles.balancePillValue, { color: theme.colors.text }]}
              >
                ₦
                {availableReady.toLocaleString('en-NG', {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.balancePillLabel,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Pending
                </Text>
                <Text
                  style={[
                    styles.balancePillValue,
                    { color: theme.colors.text, fontSize: 15 },
                  ]}
                >
                  ₦
                  {pendingBlocked.toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.balancePillLabel,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  In transit
                </Text>
                <Text
                  style={[
                    styles.balancePillValue,
                    { color: theme.colors.text, fontSize: 15 },
                  ]}
                >
                  ₦
                  {inTransitAmount.toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              </View>
            </View>
            {waitReasons.length > 0 ? (
              <View style={{ marginTop: 12 }}>
                {waitReasons.map((reason) => (
                  <Text
                    key={reason}
                    style={{
                      color: theme.colors.textSecondary,
                      fontSize: 13,
                      lineHeight: 18,
                    }}
                  >
                    {reason}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>

          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
            Bank
          </Text>
          <TouchableOpacity
            style={[
              styles.input,
              styles.selectInput,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => setPickerOpen(true)}
            disabled={banksLoading || submitting}
          >
            <Text
              style={{
                color: selectedBank
                  ? theme.colors.text
                  : theme.colors.textTertiary,
                fontSize: 16,
              }}
            >
              {banksLoading
                ? 'Loading banks…'
                : (selectedBank?.name ?? 'Select your bank')}
            </Text>
            <ChevronDown
              size={20}
              color={theme.colors.textSecondary}
              strokeWidth={2}
            />
          </TouchableOpacity>

          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
            Account number
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
            placeholder="10-digit account number"
            placeholderTextColor={theme.colors.textTertiary}
            value={accountNumber}
            onChangeText={(t) => {
              setAccountNumber(t.replace(/\D/g, '').slice(0, 10));
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={10}
            editable={!submitting}
          />

          {resolving ? (
            <View style={styles.resolveRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text
                style={[
                  styles.resolveText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Verifying account…
              </Text>
            </View>
          ) : accountName ? (
            <View style={styles.resolveRow}>
              <CheckCircle size={16} color="#10B981" strokeWidth={2} />
              <Text
                style={[
                  styles.resolveText,
                  { color: '#10B981', fontWeight: '600' },
                ]}
              >
                {accountName}
              </Text>
            </View>
          ) : null}

          {error ? (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: theme.colors.primary },
              submitting && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={
              submitting || availableAmount < MIN_NAIRA || inTransitAmount > 0
            }
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Confirm payout</Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
            Minimum ₦{MIN_NAIRA}. You will be asked for your 4-digit withdrawal
            PIN.{' '}
            {!pinStatusLoading && !hasPin ? (
              <Text
                style={{ color: theme.colors.primary, fontWeight: '600' }}
                onPress={() => router.push('/(rider)/withdrawal-pin')}
              >
                Set PIN
              </Text>
            ) : null}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <WithdrawalPinModal
        visible={pinModalOpen}
        title="Confirm payout"
        subtitle="Enter your 4-digit withdrawal PIN"
        loading={submitting}
        error={pinError}
        onClose={() => {
          if (!submitting) setPinModalOpen(false);
        }}
        onSubmit={processPayout}
      />

      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.card,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Select bank
              </Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)}>
                <X size={24} color={theme.colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <View
              style={[
                styles.searchBox,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Search
                size={18}
                color={theme.colors.textSecondary}
                strokeWidth={2}
              />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search banks"
                placeholderTextColor={theme.colors.textTertiary}
                value={bankSearch}
                onChangeText={setBankSearch}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredBanks}
              keyExtractor={(item) => item._renderKey}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.bankRow,
                    { borderBottomColor: theme.colors.border },
                  ]}
                  onPress={() => {
                    setSelectedBank(item);
                    setPickerOpen(false);
                    setBankSearch('');
                    setError(null);
                  }}
                >
                  <Text style={{ color: theme.colors.text, fontSize: 16 }}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
  balancePill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  balancePillLabel: { fontSize: 14, fontWeight: '600' },
  balancePillValue: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 14, marginBottom: 8, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  selectInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resolveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -6,
    marginBottom: 12,
  },
  resolveText: { fontSize: 14 },
  errorText: { fontSize: 14, marginBottom: 12 },
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, marginTop: 16, textAlign: 'center', lineHeight: 18 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 16 },
  bankRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
});

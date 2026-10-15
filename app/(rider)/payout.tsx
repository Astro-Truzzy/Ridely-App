import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  View,
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
import { Text } from '@/components/Text';
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
  Clock,
  Landmark,
  History,
  Info,
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import {
  useEarnings,
  MIN_PAYOUT_NAIRA,
} from '@/hooks/useEarnings';
import { useWithdrawalPin } from '@/hooks/useWithdrawalPin';
import { WithdrawalPinModal } from '@/components/WithdrawalPinModal';
import {
  fetchBanks,
  verifyRiderBank,
  type Bank,
} from '@/lib/paystack';

type BankWithRenderKey = Bank & { _renderKey: string };

const formatNaira = (amount: number) =>
  `₦${Number(amount || 0).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function maskAccount(accountNumber: string | null): string {
  if (!accountNumber || accountNumber.length < 4) return '••••';
  return `•••• ${accountNumber.slice(-4)}`;
}

const PAYOUT_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  initiated: { label: 'Initiated', color: '#B45309' },
  transfer_pending: { label: 'On the way', color: '#B45309' },
  transfer_success: { label: 'Paid', color: '#10B981' },
  transfer_failed_released: { label: 'Failed · back in balance', color: '#EF4444' },
  transfer_reversed_released: { label: 'Reversed · back in balance', color: '#EF4444' },
  failed: { label: 'Failed', color: '#EF4444' },
};

/**
 * Automatic payouts (Phase 6: scheduled-only). Riders no longer request
 * payouts manually — earnings are swept twice daily (00:00 + 18:00 WAT) to the
 * rider's verified bank account. This screen shows the breakdown, verifies
 * bank destinations, and lists payout history. Pending transfers are never
 * shown as received.
 */
export default function RiderPayoutScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { showAlert, showToast } = useAlert();
  const {
    earnings,
    payoutRequests,
    riderBanks,
    verifiedBank,
    availableAmount,
    reservedAmount,
    inTransitAmount,
    paidOutAmount,
    todayGross,
    todayCommission,
    todayEarnings,
    nextSettlementLabel,
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

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

  const verifyAndSave = async (withdrawalPin: string) => {
    if (!selectedBank || accountNumber.length !== 10) return;
    setPinError(null);
    setSubmitting(true);
    try {
      const result = await verifyRiderBank({
        accountNumber,
        bankCode: selectedBank.code,
        withdrawalPin,
      });
      if (!result.success) {
        setPinError(result.error ?? 'Verification failed');
        return;
      }
      setPinModalOpen(false);
      setSelectedBank(null);
      setAccountNumber('');
      await refetchEarnings();
      showToast(result.message ?? 'Bank account verified for automatic payouts.');
    } catch (e) {
      setPinError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = () => {
    setError(null);
    if (!selectedBank) {
      setError('Select your bank');
      return;
    }
    if (accountNumber.length !== 10) {
      setError('Enter a valid 10-digit account number');
      return;
    }
    if (!hasPin) {
      showAlert(
        'Withdrawal PIN required',
        'Set a 4-digit PIN before verifying a bank account.',
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
          Payouts
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
          {/* Automatic payout explainer */}
          <View
            style={[
              styles.noticeCard,
              {
                backgroundColor: isDark ? theme.colors.surface : '#F0F2FF',
              },
            ]}
          >
            <Info size={18} color={theme.colors.primary} strokeWidth={2} />
            <Text
              style={[styles.noticeText, { color: theme.colors.textSecondary }]}
            >
              Payouts are automatic — earnings are sent to your verified bank
              account twice daily (12:00 AM & 6:00 PM WAT). Next run:{' '}
              <Text style={{ fontWeight: '700', color: theme.colors.text }}>
                {nextSettlementLabel}
              </Text>
            </Text>
          </View>

          {/* Summary */}
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <SummaryRow
              label="Awaiting payout"
              value={formatNaira(availableAmount)}
              theme={theme}
              hint="Swept at the next run"
            />
            {reservedAmount > 0 ? (
              <SummaryRow
                label="Reserved in pending transfer"
                value={formatNaira(reservedAmount)}
                theme={theme}
                hint="Confirmed only when the bank transfer succeeds"
              />
            ) : null}
            {inTransitAmount > 0 ? (
              <SummaryRow
                label="In transit"
                value={formatNaira(inTransitAmount)}
                theme={theme}
                hint="On the way — not yet received"
              />
            ) : null}
            <SummaryRow
              label="Paid to date"
              value={formatNaira(paidOutAmount)}
              theme={theme}
              hint="Confirmed bank transfers only"
            />
          </View>

          {/* Today breakdown */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Today
          </Text>
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <SummaryRow label="Gross" value={formatNaira(todayGross)} theme={theme} />
            <SummaryRow
              label="Ridely commission (15%)"
              value={formatNaira(todayCommission)}
              theme={theme}
            />
            <SummaryRow label="Net" value={formatNaira(todayEarnings)} theme={theme} />
          </View>

          {/* Bank destination */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Payout bank account
          </Text>
          {verifiedBank ? (
            <View
              style={[
                styles.bankCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Landmark size={22} color={theme.colors.primary} strokeWidth={2} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.bankName, { color: theme.colors.text }]}>
                  {verifiedBank.account_name ?? 'Verified account'}
                </Text>
                <Text
                  style={[
                    styles.bankMeta,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {maskAccount(verifiedBank.account_number)} · verified for
                  automatic payouts
                </Text>
              </View>
              <CheckCircle size={18} color="#10B981" strokeWidth={2} />
            </View>
          ) : (
            <View
              style={[
                styles.noticeCard,
                {
                  backgroundColor: isDark ? theme.colors.surface : '#FEF3C7',
                },
              ]}
            >
              <Clock size={18} color="#B45309" strokeWidth={2} />
              <Text
                style={[styles.noticeText, { color: theme.colors.textSecondary }]}
              >
                No verified bank account yet — verify one below or your earnings
                will wait for the next run after you do. Amounts under ₦
                {MIN_PAYOUT_NAIRA} carry forward automatically.
              </Text>
            </View>
          )}

          {riderBanks.filter((b) => !b.verified_at).length > 0 ? (
            <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
              Unverified entries are never paid to — complete verification below.
            </Text>
          ) : null}

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
            onPress={handleVerify}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify bank account</Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
            You will be asked for your 4-digit withdrawal PIN.{' '}
            {!pinStatusLoading && !hasPin ? (
              <Text
                style={{ color: theme.colors.primary, fontWeight: '600' }}
                onPress={() => router.push('/(rider)/withdrawal-pin')}
              >
                Set PIN
              </Text>
            ) : null}
          </Text>

          {/* Payout history */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Payout history
          </Text>
          {payoutRequests.length === 0 ? (
            <View
              style={[
                styles.noticeCard,
                {
                  backgroundColor: isDark ? theme.colors.surface : '#F3F4F6',
                },
              ]}
            >
              <History size={18} color={theme.colors.textSecondary} strokeWidth={2} />
              <Text
                style={[styles.noticeText, { color: theme.colors.textSecondary }]}
              >
                No payouts yet. Completed earnings will appear here after the
                first scheduled run.
              </Text>
            </View>
          ) : (
            payoutRequests.map((p) => {
              const meta = PAYOUT_STATUS_LABEL[p.status] ?? {
                label: p.status,
                color: theme.colors.textSecondary,
              };
              return (
                <View
                  key={p.id}
                  style={[
                    styles.historyRow,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.historyAmount, { color: theme.colors.text }]}
                    >
                      {formatNaira(Number(p.amount || 0))}
                    </Text>
                    <Text
                      style={[
                        styles.historyMeta,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {new Date(p.created_at).toLocaleDateString('en-NG', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      · {maskAccount(p.account_number)}
                    </Text>
                  </View>
                  <Text style={[styles.statusPill, { color: meta.color }]}>
                    {meta.label}
                  </Text>
                </View>
              );
            })
          )}

          {/* Earnings history */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Recent earnings
          </Text>
          {earnings.slice(0, 20).map((e) => (
            <View
              key={e.id}
              style={[
                styles.historyRow,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.historyAmount, { color: theme.colors.text }]}
                >
                  {formatNaira(Number(e.net_amount || 0))}
                </Text>
                <Text
                  style={[
                    styles.historyMeta,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {formatNaira(Number(e.gross_amount || 0))} −{' '}
                  {formatNaira(Number(e.ridely_fee || 0))} commission ·{' '}
                  {new Date(e.created_at).toLocaleDateString('en-NG', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              <Text
                style={[
                  styles.statusPill,
                  {
                    color:
                      e.status === 'paid'
                        ? '#10B981'
                        : theme.colors.textSecondary,
                  },
                ]}
              >
                {e.status === 'paid' ? 'Paid out' : 'Awaiting payout'}
              </Text>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      <WithdrawalPinModal
        visible={pinModalOpen}
        title="Verify bank account"
        subtitle="Enter your 4-digit withdrawal PIN"
        loading={submitting}
        error={pinError}
        onClose={() => {
          if (!submitting) setPinModalOpen(false);
        }}
        onSubmit={verifyAndSave}
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

function SummaryRow({
  label,
  value,
  hint,
  theme,
}: {
  label: string;
  value: string;
  hint?: string;
  theme: any;
}) {
  return (
    <View style={styles.summaryRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
        {hint ? (
          <Text style={[styles.summaryHint, { color: theme.colors.textTertiary }]}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
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
  noticeCard: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: { fontSize: 14, fontWeight: '600' },
  summaryHint: { fontSize: 12, marginTop: 2 },
  summaryValue: { fontSize: 16, fontWeight: '800' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginTop: 20, marginBottom: 12 },
  bankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  bankName: { fontSize: 15, fontWeight: '700' },
  bankMeta: { fontSize: 13, marginTop: 2 },
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
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  historyAmount: { fontSize: 15, fontWeight: '700' },
  historyMeta: { fontSize: 12, marginTop: 2 },
  statusPill: { fontSize: 12, fontWeight: '700' },
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

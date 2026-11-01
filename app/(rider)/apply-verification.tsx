import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Linking,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { Text } from '@/components/Text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system/legacy';
import { getDocumentAsync } from '@/lib/documentPicker';
import {
  ArrowLeft,
  FileText,
  Upload,
  ShieldCheck,
  Clock,
  XCircle,
  CircleCheck as CheckCircle,
  Trash2,
  Eye,
  Landmark,
  ChevronDown,
  Search,
  X,
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { supabase } from '@/lib/supabase';
import {
  uploadVerificationDocument,
  getVerificationDocumentSignedUrl,
  type VerificationDocumentType,
  type PickedDocument,
} from '@/lib/verificationUpload';
import {
  fetchBanks,
  verifyRiderBank,
  type Bank,
} from '@/lib/paystack';
import { useWithdrawalPin } from '@/hooks/useWithdrawalPin';
import { WithdrawalPinModal } from '@/components/WithdrawalPinModal';

const DOCUMENT_LABELS: Record<VerificationDocumentType, string> = {
  nin: 'National ID (NIN)',
  guarantor_letter: "Guarantor's Letter",
  drivers_license: "Driver's License",
  vehicle_registration: 'Vehicle Registration',
  other: 'Other Document',
};

const REQUIRED_TYPES: VerificationDocumentType[] = [
  'nin',
  'guarantor_letter',
  'drivers_license',
];

type VerificationStatus = 'not_submitted' | 'pending' | 'verified' | 'rejected';

type RiderBankRow = {
  account_number: string;
  bank_code: string;
  account_name: string | null;
  verified_at: string | null;
};

function maskAccount(accountNumber: string | null): string {
  if (!accountNumber || accountNumber.length < 4) return '••••';
  return `•••• ${accountNumber.slice(-4)}`;
}

export default function ApplyVerificationScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user, userProfile, userType, refreshProfile } = useAuth();
  const { showAlert } = useAlert();
  const [uploads, setUploads] = useState<Partial<Record<VerificationDocumentType, PickedDocument>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState<
    { document_type: VerificationDocumentType; file_name: string | null; file_path: string; review_status: 'pending' | 'approved' | 'rejected' }[]
  >([]);
  const [openingPath, setOpeningPath] = useState<string | null>(null);

  // Payout bank account — must be Paystack-verified before submitting.
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [bankName, setBankName] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [bankError, setBankError] = useState<string | null>(null);
  const [verifyingBank, setVerifyingBank] = useState(false);
  const [banksList, setBanksList] = useState<RiderBankRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const { hasPin, loading: pinStatusLoading } = useWithdrawalPin();

  const riderProfile = userType === 'rider' ? (userProfile as Record<string, unknown> | null) : null;
  const status = (riderProfile?.account_verification_status as VerificationStatus | undefined) ?? 'not_submitted';

  const loadExistingDocs = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('rider_verification_documents')
      .select('document_type, file_name, file_path, review_status')
      .eq('rider_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      const byType = new Map<
        VerificationDocumentType,
        { file_name: string | null; file_path: string; review_status: 'pending' | 'approved' | 'rejected' }
      >();
      (data as typeof documents).forEach((row) => {
        // Rows are newest-first, so the first one we see per type is the latest.
        if (!byType.has(row.document_type)) {
          byType.set(row.document_type, {
            file_name: row.file_name,
            file_path: row.file_path,
            review_status: row.review_status,
          });
        }
      });
      setDocuments(
        Array.from(byType.entries()).map(([document_type, v]) => ({ document_type, ...v }))
      );
    }
  };

  useEffect(() => {
    loadExistingDocs();
  }, [user?.id]);

  const loadBanks = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await (supabase as any)
      .from('rider_banks')
      .select('account_number, bank_code, account_name, verified_at')
      .eq('rider_id', user.id)
      .order('verified_at', { ascending: false, nullsFirst: false });
    setBanksList(((data ?? []) as RiderBankRow[]));
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadBanks();
    }, [loadBanks]),
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchBanks();
        if (mounted) setBanks(list);
      } catch (e) {
        if (mounted)
          setBankError(e instanceof Error ? e.message : 'Could not load banks');
      } finally {
        if (mounted) setBanksLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadExistingDocs(), loadBanks()]);
    setRefreshing(false);
  };

  const pickDocument = async (documentType: VerificationDocumentType) => {
    try {
      const result = await getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      let stableUri = file.uri;
      try {
        const dir = `${FileSystem.documentDirectory}verification-documents/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const safeName = (file.name ?? `doc_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const localPath = `${dir}${Date.now()}_${safeName}`;
        await FileSystem.copyAsync({ from: file.uri, to: localPath });
        stableUri = localPath;
      } catch (copyError) {
        // Fallback to original picker URI if copy fails in a platform-specific edge case.
        console.warn('Document local copy failed, using original URI:', copyError);
      }
      setUploads((prev) => ({
        ...prev,
        [documentType]: {
          uri: stableUri,
          name: file.name ?? 'document',
          mimeType: file.mimeType ?? undefined,
        },
      }));
    } catch (e) {
      console.error('Document pick error:', e);
      showAlert('Error', 'Could not pick document. Try again.');
    }
  };

  const removeUpload = (documentType: VerificationDocumentType) => {
    setUploads((prev) => {
      const next = { ...prev };
      delete next[documentType];
      return next;
    });
  };

  const getDisplayName = (documentType: VerificationDocumentType): string | null => {
    const u = uploads[documentType];
    if (u) return u.name;
    const existing = documents.find((d) => d.document_type === documentType);
    return existing?.file_name ?? null;
  };

  const openDocument = async (filePath: string) => {
    setOpeningPath(filePath);
    try {
      const url = await getVerificationDocumentSignedUrl(filePath);
      if (!url) {
        showAlert('Unavailable', 'Could not open this document. Please try again.');
        return;
      }
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        showAlert('Unavailable', 'No app is available to open this document.');
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      console.error('Open document error:', e);
      showAlert('Error', 'Could not open this document.');
    } finally {
      setOpeningPath(null);
    }
  };

  const verifiedBank = useMemo(
    () => banksList.find((b) => !!b.verified_at) ?? null,
    [banksList]
  );

  const filteredBanks = useMemo(() => {
    const q = bankSearch.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter((b) => b.name.toLowerCase().includes(q));
  }, [banks, bankSearch]);

  const verifyAndSaveBank = async (withdrawalPin: string) => {
    if (!selectedBank || accountNumber.length !== 10) return;
    setPinError(null);
    setVerifyingBank(true);
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
      setBankName(result.account_name ?? null);
      setBankError(null);
      await loadBanks();
      showAlert(
        'Bank account verified',
        result.message ?? 'Your bank account is verified for automatic payouts.'
      );
    } catch (e) {
      setPinError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifyingBank(false);
    }
  };

  const handleVerifyBank = () => {
    setBankError(null);
    if (!selectedBank) {
      setBankError('Select your bank');
      return;
    }
    if (accountNumber.length !== 10) {
      setBankError('Enter a valid 10-digit account number');
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
        ]
      );
      return;
    }
    setPinError(null);
    setPinModalOpen(true);
  };

  const reviewLabel: Record<'pending' | 'approved' | 'rejected', string> = {
    pending: 'Under review',
    approved: 'Approved',
    rejected: 'Rejected',
  };

  const reviewColor = (rs: 'pending' | 'approved' | 'rejected') =>
    rs === 'approved' ? theme.colors.success : rs === 'rejected' ? theme.colors.error : theme.colors.warning;

  const hasRequiredUploads =
    status === 'rejected'
      ? REQUIRED_TYPES.every((t) => uploads[t])
      : REQUIRED_TYPES.every((t) => uploads[t] ?? documents.some((d) => d.document_type === t));

  const hasVerifiedBank = !!verifiedBank;

  const handleSubmit = async () => {
    if (!user?.id || userType !== 'rider') return;
    if (!hasRequiredUploads) {
      showAlert(
        'Documents required',
        'Please upload at least: National ID (NIN), Guarantor\'s Letter, and Driver\'s License.'
      );
      return;
    }
    if (!hasVerifiedBank) {
      await loadBanks();
      showAlert(
        'Bank account required',
        'Verify your bank account below first — payouts are automatic (twice daily), so a verified account is required before you can submit.'
      );
      return;
    }
    setSubmitting(true);
    try {
      const toUpload = Object.entries(uploads).filter(
        ([, v]) => v != null
      ) as [VerificationDocumentType, PickedDocument][];

      for (const [documentType, picked] of toUpload) {
        const { filePath, fileName } = await uploadVerificationDocument(user.id, documentType, picked);
        await (supabase as any).from('rider_verification_documents').insert({
          rider_id: user.id,
          document_type: documentType,
          file_path: filePath,
          file_name: fileName,
          review_status: 'pending',
        });
      }

      await (supabase as any).from('riders').update({ account_verification_status: 'pending' }).eq('id', user.id);

      await refreshProfile();
      setUploads({});
      await loadExistingDocs();
      showAlert(
        'Application submitted',
        'Your documents have been submitted for verification. You will be notified once reviewed. You cannot accept delivery requests until verified.'
      );
      router.back();
    } catch (e) {
      console.error('Submit verification error:', e);
      showAlert(
        'Error',
        e instanceof Error ? e.message : 'Failed to submit. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const statusConfig: Record<
    VerificationStatus,
    { icon: typeof ShieldCheck; label: string; color: string; message: string }
  > = {
    not_submitted: {
      icon: Clock,
      label: 'Not submitted',
      color: theme.colors.warning,
      message: 'Upload the required documents below to apply for verification.',
    },
    pending: {
      icon: Clock,
      label: 'Under review',
      color: theme.colors.warning,
      message: 'Your documents are being reviewed. You cannot accept deliveries until verified.',
    },
    verified: {
      icon: CheckCircle,
      label: 'Verified',
      color: theme.colors.success,
      message: 'You can accept delivery requests.',
    },
    rejected: {
      icon: XCircle,
      label: 'Rejected',
      color: theme.colors.error,
      message: 'Your application was rejected. You can re-upload documents and apply again.',
    },
  };

  const config = statusConfig[status];
  const canEdit = status === 'not_submitted' || status === 'rejected';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { paddingTop: 12 + insets.top, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.colors.surface }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Apply for Verification</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        <View style={[styles.statusCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
          <View style={[styles.statusBadge, { backgroundColor: `${config.color}20` }]}>
            <config.icon size={28} color={config.color} strokeWidth={2} />
          </View>
          <Text style={[styles.statusLabel, { color: theme.colors.text }]}>{config.label}</Text>
          <Text style={[styles.statusMessage, { color: theme.colors.textSecondary }]}>{config.message}</Text>
        </View>

        {documents.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Your uploaded documents</Text>
            {documents.map((doc) => (
              <View
                key={doc.document_type}
                style={[styles.docRow, { backgroundColor: theme.colors.surface }, theme.shadows.small]}
              >
                <FileText size={20} color={theme.colors.primary} strokeWidth={2} />
                <View style={styles.docInfo}>
                  <Text style={[styles.docLabel, { color: theme.colors.text }]}>
                    {DOCUMENT_LABELS[doc.document_type]}
                  </Text>
                  <Text
                    style={[styles.docFileName, { color: theme.colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {doc.file_name ?? 'Document'}
                  </Text>
                  <View style={[styles.reviewBadge, { backgroundColor: `${reviewColor(doc.review_status)}20` }]}>
                    <Text style={[styles.reviewBadgeText, { color: reviewColor(doc.review_status) }]}>
                      {reviewLabel[doc.review_status]}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: `${theme.colors.primary}20` }]}
                  onPress={() => openDocument(doc.file_path)}
                  disabled={openingPath === doc.file_path}
                >
                  {openingPath === doc.file_path ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <Eye size={18} color={theme.colors.primary} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {canEdit && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Required documents (Nigeria dispatch riders)
            </Text>
            {(REQUIRED_TYPES as VerificationDocumentType[]).map((documentType) => (
              <View
                key={documentType}
                style={[styles.docRow, { backgroundColor: theme.colors.surface }, theme.shadows.small]}
              >
                <FileText size={20} color={theme.colors.primary} strokeWidth={2} />
                <View style={styles.docInfo}>
                  <Text style={[styles.docLabel, { color: theme.colors.text }]}>
                    {DOCUMENT_LABELS[documentType]}
                  </Text>
                  <Text
                    style={[styles.docFileName, { color: theme.colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {getDisplayName(documentType) ?? 'Not uploaded'}
                  </Text>
                </View>
                <View style={styles.docActions}>
                  {getDisplayName(documentType) ? (
                    <>
                      <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: `${theme.colors.primary}20` }]}
                        onPress={() => pickDocument(documentType)}
                      >
                        <Upload size={18} color={theme.colors.primary} strokeWidth={2} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: `${theme.colors.error}20` }]}
                        onPress={() => removeUpload(documentType)}
                      >
                        <Trash2 size={18} color={theme.colors.error} strokeWidth={2} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.uploadBtn, { backgroundColor: theme.colors.primary }]}
                      onPress={() => pickDocument(documentType)}
                    >
                      <Upload size={18} color="#FFF" strokeWidth={2} />
                      <Text style={styles.uploadBtnText}>Upload</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Optional</Text>
            {(['vehicle_registration', 'other'] as VerificationDocumentType[]).map((documentType) => (
              <View
                key={documentType}
                style={[styles.docRow, { backgroundColor: theme.colors.surface }, theme.shadows.small]}
              >
                <FileText size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                <View style={styles.docInfo}>
                  <Text style={[styles.docLabel, { color: theme.colors.text }]}>
                    {DOCUMENT_LABELS[documentType]}
                  </Text>
                  <Text
                    style={[styles.docFileName, { color: theme.colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {getDisplayName(documentType) ?? 'Optional'}
                  </Text>
                </View>
                <View style={styles.docActions}>
                  <TouchableOpacity
                    style={[styles.uploadBtn, { backgroundColor: theme.colors.border }]}
                    onPress={() => pickDocument(documentType)}
                  >
                    <Upload size={18} color={theme.colors.text} strokeWidth={2} />
                    <Text style={[styles.uploadBtnText, { color: theme.colors.text }]}>Upload</Text>
                  </TouchableOpacity>
                  {getDisplayName(documentType) && (
                    <TouchableOpacity
                      style={[styles.smallBtn, { backgroundColor: `${theme.colors.error}20` }]}
                      onPress={() => removeUpload(documentType)}
                    >
                      <Trash2 size={18} color={theme.colors.error} strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Account details (for payouts)
            </Text>
            <Text style={[styles.bankHint, { color: theme.colors.textSecondary }]}>
              Earnings are paid automatically twice daily (12:00 AM &amp; 6:00 PM WAT).
              Verify the bank account you want payouts sent to — this is required
              before you can submit.
            </Text>

            {verifiedBank ? (
              <View
                style={[styles.docRow, { backgroundColor: theme.colors.surface }, theme.shadows.small]}
              >
                <Landmark size={20} color={theme.colors.primary} strokeWidth={2} />
                <View style={styles.docInfo}>
                  <Text style={[styles.docLabel, { color: theme.colors.text }]}>
                    {verifiedBank.account_name ?? bankName ?? 'Verified account'}
                  </Text>
                  <Text
                    style={[styles.docFileName, { color: theme.colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {maskAccount(verifiedBank.account_number)} · verified for automatic payouts
                  </Text>
                </View>
                <CheckCircle size={20} color={theme.colors.success} strokeWidth={2} />
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.docRow,
                { backgroundColor: theme.colors.surface, opacity: banksLoading || verifyingBank ? 0.7 : 1 },
                theme.shadows.small,
              ]}
              onPress={() => !(banksLoading || verifyingBank) && setPickerOpen(true)}
              disabled={banksLoading || verifyingBank}
            >
              <View style={styles.docInfo}>
                <Text style={[styles.docLabel, { color: theme.colors.text }]}>Bank</Text>
                <Text
                  style={[styles.docFileName, { color: theme.colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {banksLoading ? 'Loading banks…' : (selectedBank?.name ?? 'Select your bank')}
                </Text>
              </View>
              <ChevronDown size={20} color={theme.colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>

            <View
              style={[styles.docRow, { backgroundColor: theme.colors.surface }, theme.shadows.small]}
            >
              <View style={styles.docInfo}>
                <Text style={[styles.docLabel, { color: theme.colors.text }]}>Account number</Text>
                <TextInput
                  style={[styles.bankInput, { color: theme.colors.text }]}
                  placeholder="10-digit account number"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={accountNumber}
                  onChangeText={(t) => {
                    setAccountNumber(t.replace(/\D/g, '').slice(0, 10));
                    setBankError(null);
                  }}
                  keyboardType="number-pad"
                  maxLength={10}
                  editable={!verifyingBank}
                />
              </View>
            </View>

            {bankError ? (
              <Text style={[styles.bankError, { color: theme.colors.error }]}>{bankError}</Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.verifyBankBtn,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary },
              ]}
              onPress={handleVerifyBank}
              disabled={verifyingBank}
            >
              {verifyingBank ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <>
                  <Landmark size={18} color={theme.colors.primary} strokeWidth={2} />
                  <Text style={[styles.verifyBankBtnText, { color: theme.colors.primary }]}>
                    {verifiedBank ? 'Verify a different account' : 'Verify bank account'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={[styles.bankHint, { color: theme.colors.textSecondary }]}>
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

            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: theme.colors.primary },
                theme.shadows.medium,
              ]}
              onPress={handleSubmit}
              disabled={submitting || !hasRequiredUploads}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <ShieldCheck size={22} color="#FFF" strokeWidth={2} />
                  <Text style={styles.submitBtnText}>Submit for verification</Text>
                </>
              )}
            </TouchableOpacity>
            {!hasVerifiedBank ? (
              <Text style={[styles.bankHint, { color: theme.colors.warning, textAlign: 'center' }]}>
                A verified bank account is required before submitting.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>

      <WithdrawalPinModal
        visible={pinModalOpen}
        title="Verify bank account"
        subtitle="Enter your 4-digit withdrawal PIN"
        loading={verifyingBank}
        error={pinError}
        onClose={() => {
          if (!verifyingBank) setPinModalOpen(false);
        }}
        onSubmit={verifyAndSaveBank}
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
              keyExtractor={(item) => `${item.code}-${item.name}`}
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
                    setBankError(null);
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
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  headerSpacer: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  statusCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  statusBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  statusMessage: { fontSize: 14, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  docInfo: { flex: 1, marginLeft: 12 },
  docLabel: { fontSize: 15, fontWeight: '600' },
  docFileName: { fontSize: 13, marginTop: 2 },
  reviewBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  reviewBadgeText: { fontSize: 11, fontWeight: '700' },
  docActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  uploadBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 24,
    gap: 10,
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  bankHint: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  bankInput: { fontSize: 15, marginTop: 4, paddingVertical: 4 },
  bankError: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  verifyBankBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 4,
    gap: 8,
  },
  verifyBankBtnText: { fontSize: 15, fontWeight: '700' },
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

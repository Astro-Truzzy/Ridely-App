import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated from 'react-native-reanimated';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Package,
  DollarSign,
  User,
  CircleCheck as CheckCircle,
  Navigation,
} from 'lucide-react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { useAlert } from '@/contexts/AlertContext';
import { cardEnterSpring, fadeEnter } from '@/lib/riderAnimations';
import { AnimatedPressable } from '@/components/rider/AnimatedPressable';
import { useAvailableJobs } from '@/hooks/useAvailableJobs';
import { useDeliveries } from '@/hooks/useDeliveries';
import type { AvailableJob } from '@/hooks/useAvailableJobs';

export default function JobDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { userProfile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { jobs, loading, refetch } = useAvailableJobs();
  const { acceptDelivery } = useDeliveries();
  const { animations: animationsEnabled } = useAppSettings();
  const { showAlert } = useAlert();
  const [accepting, setAccepting] = useState(false);
  const isVerified = (userProfile as { account_verification_status?: string } | null)?.account_verification_status === 'verified';
  const enterCard = animationsEnabled ? cardEnterSpring() : undefined;
  const enterFade = animationsEnabled ? fadeEnter() : undefined;

  const job: AvailableJob | undefined = id
    ? jobs.find((j) => j.id === id)
    : undefined;

  const handleAccept = async () => {
    if (!job) return;
    if (!isVerified) {
      showAlert(
        'Verification required',
        'You must be verified to accept deliveries. Go to Apply for verification and submit your documents.',
        [
          { text: 'OK' },
          { text: 'Apply now', onPress: () => router.push('/(rider)/apply-verification' as Href) },
        ]
      );
      return;
    }
    setAccepting(true);
    try {
      await acceptDelivery(job.id);
      const jobData = {
        id: job.id,
        reward: job.total_cost,
        parcelSize: job.parcel_size,
        pickupAddress: job.pickup_address,
        dropoffAddress: job.dropoff_address,
        distance: job.distance,
        estimatedTime: job.estimated_time,
        senderName:
          (job.users as { full_name?: string } | null)?.full_name ?? 'Customer',
        pickupCoords: null,
        dropoffCoords: null,
      };
      router.replace({
        pathname: '/(rider)/active-delivery',
        params: {
          jobId: job.id,
          jobData: JSON.stringify(jobData),
        },
      });
    } catch (err) {
      console.error('Accept job error:', err);
      showAlert(
        'Error',
        err instanceof Error ? err.message : 'Failed to accept job. It may have been taken.'
      );
      refetch();
    } finally {
      setAccepting(false);
    }
  };

  const handleBack = () => router.back();

  if (loading && !job) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['left', 'right', 'bottom']}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading job...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['left', 'right', 'bottom']}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={[styles.header, { borderBottomColor: theme.colors.border, paddingTop: 12 + insets.top }]}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.colors.surface }]}
            onPress={handleBack}
          >
            <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Job Details
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Package size={48} color={theme.colors.textTertiary} strokeWidth={2} />
          <Text style={[styles.unavailableTitle, { color: theme.colors.text }]}>
            Job no longer available
          </Text>
          <Text
            style={[
              styles.unavailableText,
              { color: theme.colors.textSecondary },
            ]}
          >
            This delivery may have been accepted by another rider.
          </Text>
          <TouchableOpacity
            style={[styles.backToDashboard, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.replace('/(rider)/dashboard')}
          >
            <Text style={styles.backToDashboardText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const senderName =
    (job.users as { full_name?: string } | null)?.full_name ?? 'Customer';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { borderBottomColor: theme.colors.border, paddingTop: 12 + insets.top }]}>
        <AnimatedPressable
          style={[styles.backButton, { backgroundColor: theme.colors.surface }]}
          onPress={handleBack}
        >
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </AnimatedPressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Delivery #{job.id.slice(0, 8)}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={enterCard}
          style={[styles.rewardCard, { backgroundColor: theme.colors.surface }]}
        >
          <DollarSign size={28} color={theme.colors.success} strokeWidth={2} />
          <View style={styles.rewardInfo}>
            <Text style={[styles.rewardLabel, { color: theme.colors.textSecondary }]}>
              Reward
            </Text>
            <Text style={[styles.rewardAmount, { color: theme.colors.success }]}>
              ₦{job.total_cost.toLocaleString('en-NG')}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          entering={enterFade}
          style={[styles.section, { backgroundColor: theme.colors.surface }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Package & sender
          </Text>
          <View style={styles.row}>
            <Package size={20} color={theme.colors.primary} strokeWidth={2} />
            <Text style={[styles.rowText, { color: theme.colors.text }]}>
              {job.parcel_size.charAt(0).toUpperCase() + job.parcel_size.slice(1)}{' '}
              package
            </Text>
          </View>
          <View style={styles.row}>
            <User size={20} color={theme.colors.primary} strokeWidth={2} />
            <Text style={[styles.rowText, { color: theme.colors.text }]}>
              {senderName}
            </Text>
          </View>
          <View style={styles.row}>
            <Clock size={20} color={theme.colors.primary} strokeWidth={2} />
            <Text style={[styles.rowText, { color: theme.colors.text }]}>
              {job.delivery_time === 'now'
                ? 'ASAP'
                : job.scheduled_time
                  ? `Scheduled: ${new Date(job.scheduled_time).toLocaleString()}`
                  : 'Scheduled'}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          entering={enterFade}
          style={[styles.section, { backgroundColor: theme.colors.surface }]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Route
          </Text>
          <View style={styles.addressRow}>
            <MapPin size={18} color={theme.colors.success} strokeWidth={2} />
            <Text style={[styles.addressText, { color: theme.colors.text }]}>
              {job.pickup_address}
            </Text>
          </View>
          <View style={[styles.addressDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.addressRow}>
            <MapPin size={18} color={theme.colors.error} strokeWidth={2} />
            <Text style={[styles.addressText, { color: theme.colors.text }]}>
              {job.dropoff_address}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Navigation size={16} color={theme.colors.textSecondary} strokeWidth={2} />
              <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                {job.distance} km
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Clock size={16} color={theme.colors.textSecondary} strokeWidth={2} />
              <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                ~{job.estimated_time}
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={enterCard} style={styles.actions}>
          <AnimatedPressable
            style={[styles.rejectButton, { borderColor: theme.colors.error }]}
            onPress={handleBack}
            disabled={accepting}
          >
            <Text style={[styles.rejectText, { color: theme.colors.error }]}>
              Back
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.acceptButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleAccept}
            disabled={accepting}
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <CheckCircle size={22} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.acceptText}>Accept Job</Text>
              </>
            )}
          </AnimatedPressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  unavailableTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  unavailableText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  backToDashboard: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  backToDashboardText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  rewardInfo: {
    marginLeft: 16,
  },
  rewardLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  rewardAmount: {
    fontSize: 28,
    fontWeight: '700',
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rowText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 15,
    marginLeft: 12,
    flex: 1,
  },
  addressDivider: {
    width: 2,
    height: 16,
    marginLeft: 9,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 24,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 14,
    marginLeft: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: {
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

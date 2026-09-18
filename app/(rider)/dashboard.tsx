import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Package,
  MapPin,
  DollarSign,
  Clock,
  User,
  Bell,
  Navigation,
  CircleCheck as CheckCircle,
  X,
  Flame,
} from 'lucide-react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
import Animated from 'react-native-reanimated';
import { staggeredCardEnter, heroEnter } from '@/lib/riderAnimations';
import { AnimatedPressable } from '@/components/rider/AnimatedPressable';
import { useAvailableJobs } from '@/hooks/useAvailableJobs';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useEarnings } from '@/hooks/useEarnings';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { CardSkeletonList } from '@/components/Skeleton';
import { tapLight, tapMedium, notifySuccess, notifyWarning, notifyError } from '@/lib/haptics';
import type { AvailableJob } from '@/hooks/useAvailableJobs';
import { buildRiderJobPayload, isRiderActiveStatus } from '@/lib/screenContracts';

export default function RiderDashboard() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user, userProfile } = useAuth();
  const { showAlert } = useAlert();
  const { unreadCount, refetchUnreadCount } = useNotifications();
  const { animations: animationsEnabled } = useAppSettings();

  useFocusEffect(
    useCallback(() => {
      refetchUnreadCount();
    }, [refetchUnreadCount])
  );
  const statEnter = (i: number) => (animationsEnabled ? staggeredCardEnter(i) : undefined);
  const jobEnter = (i: number) => (animationsEnabled ? staggeredCardEnter(i) : undefined);
  const headerEnter = animationsEnabled ? heroEnter() : undefined;
  const [isOnline, setIsOnline] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    const online = (userProfile as { is_online?: boolean } | null)?.is_online;
    if (typeof online === 'boolean') setIsOnline(online);
  }, [userProfile]);

  const handleOnlineToggle = async (value: boolean) => {
    if (!user) return;
    tapLight();
    setIsOnline(value);
    try {
      if (value) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setIsOnline(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = loc.coords;
        // RPC not inferred from Database type; cast to bypass strict RPC typings
        await (supabase as any).rpc('update_rider_location', { lat: latitude, lng: longitude });
      }
      await (supabase as any).from('riders').update({ is_online: value, is_available: value }).eq('id', user.id);
    } catch (e) {
      console.warn('Failed to update rider online status:', e);
      setIsOnline(!value);
    }
  };

  const { jobs: availableJobs, loading: jobsLoading, refetch: refetchAvailableJobs, rejectJob, removeJob } = useAvailableJobs();
  const { deliveries, acceptDelivery, refetch: refetchDeliveries } = useDeliveries();
  const { todayEarnings } = useEarnings();

  useFocusEffect(
    useCallback(() => {
      refetchAvailableJobs();
      refetchDeliveries();
    }, [refetchAvailableJobs, refetchDeliveries])
  );

  const firstName =
    ((userProfile as { full_name?: string } | null)?.full_name ?? '').trim().split(/\s+/)[0] || 'Rider';

  const greetingPrefix = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const accountVerificationStatus = (userProfile as { account_verification_status?: string } | null)?.account_verification_status ?? 'not_submitted';
  const isVerified = accountVerificationStatus === 'verified';

  const riderStats = useMemo(() => {
    const active = deliveries.filter((d) => isRiderActiveStatus(d.status)).length;
    const today = new Date().toISOString().split('T')[0];
    const completedToday = deliveries.filter(
      (d) => d.status === 'delivered' && d.completed_at?.startsWith(today)
    ).length;
    const rating =
      (userProfile as { rating?: number } | null)?.rating ?? 0;
    return {
      activeJobs: active,
      completedToday,
      todayEarnings,
      rating: rating > 0 ? rating : 4.9,
    };
  }, [deliveries, todayEarnings, userProfile]);

  const handleAcceptJob = async (job: AvailableJob) => {
    tapMedium();
    if (riderStats.activeJobs > 0) {
      showAlert(
        'Finish your current delivery',
        'Complete or cancel your active job before accepting another.'
      );
      return;
    }
    setAcceptingId(job.id);
    try {
      await acceptDelivery(job.id);
      // Optimistically drop it from the available list so it can't linger.
      removeJob(job.id);
      notifySuccess();
      const jobData = buildRiderJobPayload({
        id: job.id,
        total_cost: job.total_cost,
        parcel_size: job.parcel_size,
        pickup_address: job.pickup_address,
        dropoff_address: job.dropoff_address,
        distance: job.distance,
        estimated_time: job.estimated_time,
        senderName:
          (job.users as { full_name?: string } | null)?.full_name ?? 'Customer',
        pickup_lat: job.pickup_lat,
        pickup_lng: job.pickup_lng,
        dropoff_lat: job.dropoff_lat,
        dropoff_lng: job.dropoff_lng,
      });
      router.replace({
        pathname: '/(rider)/active-delivery',
        params: {
          jobId: job.id,
          jobData: JSON.stringify(jobData),
        },
      });
    } catch (err) {
      console.error('Accept job error:', err);
      notifyError();
      showAlert(
        'Error',
        err instanceof Error ? err.message : 'Failed to accept. Job may have been taken.'
      );
    } finally {
      setAcceptingId(null);
    }
  };

  const handleRejectJob = async (jobId: string) => {
    // Server-side per-rider rejection: hides the job from this rider across
    // devices while keeping it available to other riders. Works for verified
    // and unverified riders alike.
    notifyWarning();
    try {
      await rejectJob(jobId);
    } catch {
      notifyError();
      showAlert('Error', 'Could not reject this job. Please try again.');
    }
  };

  const handleNavigate = () => {
    const activeDelivery = deliveries.find((d) => isRiderActiveStatus(d.status));
    if (!activeDelivery) {
      showAlert(
        'No active delivery',
        'Accept a delivery from the list below to open the in-app map and navigate to pickup or dropoff.'
      );
      return;
    }
    const jobData = buildRiderJobPayload({
      id: activeDelivery.id,
      total_cost: activeDelivery.total_cost,
      parcel_size: activeDelivery.parcel_size,
      pickup_address: activeDelivery.pickup_address,
      dropoff_address: activeDelivery.dropoff_address,
      distance: activeDelivery.distance,
      estimated_time: activeDelivery.estimated_time,
      senderName: 'Customer',
      pickup_lat: activeDelivery.pickup_lat,
      pickup_lng: activeDelivery.pickup_lng,
      dropoff_lat: activeDelivery.dropoff_lat,
      dropoff_lng: activeDelivery.dropoff_lng,
    });
    router.push({
      pathname: '/(rider)/active-delivery',
      params: { jobId: activeDelivery.id, jobData: JSON.stringify(jobData) },
    });
  };

  const getSizeColor = (size: string) => {
    switch (size) {
      case 'small':
        return '#10B981';
      case 'medium':
        return '#FFC947';
      case 'large':
        return '#EF4444';
      default:
        return theme.colors.textSecondary;
    }
  };

  const getTimeAgo = (createdAt: string) => {
    const date = new Date(createdAt).getTime();
    const minutes = Math.floor((Date.now() - date) / 60000);
    if (minutes < 1) return 'Just now';
    return `${minutes}m ago`;
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header - extends under status bar */}
        <Animated.View
          entering={headerEnter}
          style={[styles.header, { paddingTop: 20 + insets.top }]}
        >
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: theme.colors.text }]}>
              {greetingPrefix}, {firstName}! 🏍️
            </Text>
            <View style={styles.onlineStatus}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isOnline ? '#10B981' : '#EF4444' },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {isOnline ? 'Online' : 'Offline'}
              </Text>
              <Switch
                value={isOnline}
                onValueChange={handleOnlineToggle}
                trackColor={{
                  false: theme.colors.border,
                  true: `${theme.colors.success}50`,
                }}
                thumbColor={
                  isOnline ? theme.colors.success : theme.colors.textTertiary
                }
                style={styles.onlineSwitch}
              />
            </View>
          </View>
          <View style={styles.headerActions}>
            <AnimatedPressable
              style={[
                styles.headerButton,
                { backgroundColor: theme.colors.surface },
                theme.shadows.medium,
              ]}
              onPress={() => router.push('/(rider)/notifications')}
            >
              <View>
                <Bell size={24} color={theme.colors.primary} strokeWidth={2} />
                {unreadCount > 0 && (
                  <View style={[styles.notificationBadge, { backgroundColor: theme.colors.error }]}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </AnimatedPressable>
            <AnimatedPressable
              style={[
                styles.headerButton,
                { backgroundColor: theme.colors.surface },
                theme.shadows.medium,
              ]}
              onPress={() => router.push('/(rider)/profile')}
            >
              <User size={24} color={theme.colors.primary} strokeWidth={2} />
            </AnimatedPressable>
          </View>
        </Animated.View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <Animated.View
            entering={statEnter(0)}
            style={[
              styles.statCard,
              { backgroundColor: theme.colors.surface },
              theme.shadows.medium,
            ]}
          >
            <Package size={24} color={theme.colors.primary} strokeWidth={2} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {riderStats.activeJobs}
            </Text>
            <Text
              style={[styles.statLabel, { color: theme.colors.textSecondary }]}
            >
              Active Jobs
            </Text>
          </Animated.View>

          <Animated.View
            entering={statEnter(1)}
            style={[
              styles.statCard,
              { backgroundColor: theme.colors.surface },
              theme.shadows.medium,
            ]}
          >
            <CheckCircle
              size={24}
              color={theme.colors.success}
              strokeWidth={2}
            />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {riderStats.completedToday}
            </Text>
            <Text
              style={[styles.statLabel, { color: theme.colors.textSecondary }]}
            >
              Completed Today
            </Text>
          </Animated.View>

          <Animated.View
            entering={statEnter(2)}
            style={[
              styles.statCard,
              { backgroundColor: theme.colors.surface },
              theme.shadows.medium,
            ]}
          >
            <DollarSign
              size={24}
              color={theme.colors.success}
              strokeWidth={2}
            />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              ₦{Number(riderStats.todayEarnings).toFixed(2)}
            </Text>
            <Text
              style={[styles.statLabel, { color: theme.colors.textSecondary }]}
            >
              Today's Earnings
            </Text>
          </Animated.View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <AnimatedPressable
            style={[
              styles.actionButton,
              { backgroundColor: theme.colors.primary },
              theme.shadows.medium,
            ]}
            onPress={() => router.push('/(rider)/earnings')}
          >
            <DollarSign size={20} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.actionText}>View Earnings</Text>
          </AnimatedPressable>

          <AnimatedPressable
            style={[
              styles.actionButton,
              { backgroundColor: theme.colors.success },
              theme.shadows.medium,
            ]}
            onPress={handleNavigate}
          >
            <Navigation size={20} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.actionText}>Navigate</Text>
          </AnimatedPressable>

          <AnimatedPressable
            style={[
              styles.actionButton,
              { backgroundColor: theme.colors.error },
              theme.shadows.medium,
            ]}
            onPress={() => router.push('/(rider)/heatmap' as Href)}
          >
            <Flame size={20} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.actionText}>Demand Map</Text>
          </AnimatedPressable>
        </View>

        {/* Verification required banner */}
        {!isVerified && (
          <AnimatedPressable
            style={[
              styles.verificationBanner,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.warning,
              },
              theme.shadows.medium,
            ]}
            onPress={() => router.push('/(rider)/apply-verification' as Href)}
          >
            <View style={[styles.verificationBannerDot, { backgroundColor: theme.colors.warning }]} />
            <View style={styles.verificationBannerContent}>
              <Text style={[styles.verificationBannerTitle, { color: theme.colors.text }]}>
                Verification required
              </Text>
              <Text style={[styles.verificationBannerText, { color: theme.colors.textSecondary }]}>
                {accountVerificationStatus === 'pending'
                  ? 'Your documents are under review. You can\'t accept deliveries until verified.'
                  : 'Upload your documents to get verified and start accepting delivery requests.'}
              </Text>
            </View>
            <Text style={[styles.verificationBannerCta, { color: theme.colors.primary }]}>
              {accountVerificationStatus === 'pending' ? 'View status' : 'Apply now'}
            </Text>
          </AnimatedPressable>
        )}

        {/* Available Jobs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Available Deliveries
            </Text>
            <Text
              style={[styles.jobCount, { color: theme.colors.textSecondary }]}
            >
              {availableJobs.length} jobs
            </Text>
          </View>

          {!isOnline && (
            <View
              style={[
                styles.offlineCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.warning,
                },
              ]}
            >
              <Text
                style={[styles.offlineText, { color: theme.colors.warning }]}
              >
                You're offline. Turn on availability to see delivery requests.
              </Text>
            </View>
          )}

          {isOnline && jobsLoading && availableJobs.length === 0 && (
            <CardSkeletonList count={3} />
          )}

          {isOnline && !jobsLoading && availableJobs.length === 0 && (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: theme.colors.surface },
                theme.shadows.medium,
              ]}
            >
              <Package
                size={48}
                color={theme.colors.textTertiary}
                strokeWidth={2}
              />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                No jobs available
              </Text>
              <Text
                style={[
                  styles.emptyText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                New delivery requests will appear here
              </Text>
            </View>
          )}

          {isOnline &&
            availableJobs.map((job, index) => {
              const senderName =
                (job.users as { full_name?: string } | null)?.full_name ??
                'Customer';
              const urgency =
                job.delivery_time === 'now' ? 'urgent' : 'normal';
              const isAccepting = acceptingId === job.id;
              return (
                <Animated.View
                  key={job.id}
                  entering={jobEnter(index)}
                  style={[
                    styles.jobCard,
                    { backgroundColor: theme.colors.surface },
                    theme.shadows.large,
                  ]}
                >
                  {urgency === 'urgent' && (
                    <View style={styles.urgentBadge}>
                      <Text style={styles.urgentText}>URGENT</Text>
                    </View>
                  )}

                  <AnimatedPressable
                    style={{ flex: 1 }}
                    onPress={() =>
                      router.push({
                        pathname: '/(rider)/job-details',
                        params: { id: job.id },
                      })
                    }
                  >
                    <View style={styles.jobHeader}>
                      <View style={styles.jobInfo}>
                        <Text style={[styles.jobId, { color: theme.colors.text }]}>
                          #{job.id.slice(0, 8)}
                        </Text>
                        <Text
                          style={[
                            styles.timeAgo,
                            { color: theme.colors.textSecondary },
                          ]}
                        >
                          {getTimeAgo(job.created_at)}
                        </Text>
                      </View>
                      <View style={styles.rewardContainer}>
                        <Text
                          style={[
                            styles.rewardAmount,
                            { color: theme.colors.success },
                          ]}
                        >
                          ₦{job.total_cost.toLocaleString('en-NG')}
                        </Text>
                        <Text
                          style={[
                            styles.rewardLabel,
                            { color: theme.colors.textSecondary },
                          ]}
                        >
                          Reward
                        </Text>
                      </View>
                    </View>

                    <View style={styles.jobDetails}>
                      <View style={styles.sizeContainer}>
                        <View
                          style={[
                            styles.sizeIndicator,
                            {
                              backgroundColor: getSizeColor(job.parcel_size),
                            },
                          ]}
                        />
                        <Text
                          style={[styles.sizeText, { color: theme.colors.text }]}
                        >
                          {job.parcel_size.charAt(0).toUpperCase() +
                            job.parcel_size.slice(1)}{' '}
                          Package
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.senderName,
                          { color: theme.colors.textSecondary },
                        ]}
                      >
                        From: {senderName}
                      </Text>
                    </View>

                    <View style={styles.addressContainer}>
                      <View style={styles.addressRow}>
                        <MapPin
                          size={16}
                          color={theme.colors.success}
                          strokeWidth={2}
                        />
                        <Text
                          style={[
                            styles.addressText,
                            { color: theme.colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {job.pickup_address}
                        </Text>
                      </View>
                      <View style={styles.addressDivider} />
                      <View style={styles.addressRow}>
                        <MapPin
                          size={16}
                          color={theme.colors.error}
                          strokeWidth={2}
                        />
                        <Text
                          style={[
                            styles.addressText,
                            { color: theme.colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {job.dropoff_address}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.jobMeta}>
                      <View style={styles.metaItem}>
                        <Navigation
                          size={16}
                          color={theme.colors.textSecondary}
                          strokeWidth={2}
                        />
                        <Text
                          style={[
                            styles.metaText,
                            { color: theme.colors.textSecondary },
                          ]}
                        >
                          {job.distance} km
                        </Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Clock
                          size={16}
                          color={theme.colors.textSecondary}
                          strokeWidth={2}
                        />
                        <Text
                          style={[
                            styles.metaText,
                            { color: theme.colors.textSecondary },
                          ]}
                        >
                          ~{job.estimated_time}
                        </Text>
                      </View>
                    </View>
                  </AnimatedPressable>

                  <View style={styles.jobActions}>
                    <Pressable
                      onPress={() => handleRejectJob(job.id)}
                      android_ripple={{
                        color: `${theme.colors.error}30`,
                        borderless: true,
                      }}
                      style={{ flex: 1 }}
                    >
                      <View
                        style={[
                          styles.rejectButton,
                          {
                            backgroundColor: `${theme.colors.error}20`,
                            borderColor: theme.colors.error,
                          },
                        ]}
                      >
                        <X
                          size={20}
                          color={theme.colors.error}
                          strokeWidth={2}
                        />
                        <Text
                          style={[
                            styles.rejectText,
                            { color: theme.colors.error },
                          ]}
                        >
                          Reject
                        </Text>
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        !isVerified
                          ? showAlert(
                              'Verification required',
                              'You must be verified to accept deliveries. Go to Apply for verification and submit your documents.',
                              [{ text: 'OK' }, { text: 'Apply now', onPress: () => router.push('/(rider)/apply-verification' as Href) }]
                            )
                          : handleAcceptJob(job)
                      }
                      disabled={isAccepting}
                      android_ripple={{
                        color: `${theme.colors.primary}30`,
                        borderless: true,
                      }}
                      style={{ flex: 2 }}
                    >
                      <View
                        style={[
                          styles.acceptButton,
                          { backgroundColor: isVerified ? theme.colors.primary : theme.colors.textTertiary },
                        ]}
                      >
                        {isAccepting ? (
                          <ActivityIndicator
                            size="small"
                            color="#FFFFFF"
                          />
                        ) : (
                          <>
                            <CheckCircle
                              size={20}
                              color="#FFFFFF"
                              strokeWidth={2}
                            />
                            <Text style={styles.acceptText}>
                              {isVerified ? 'Accept Job' : 'Verify to accept'}
                            </Text>
                          </>
                        )}
                      </View>
                    </Pressable>
                  </View>
                </Animated.View>
              );
            })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 12,
  },
  onlineSwitch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  verificationBanner: {
    marginHorizontal: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
  },
  verificationBannerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  verificationBannerContent: { flex: 1 },
  verificationBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  verificationBannerText: {
    fontSize: 13,
    lineHeight: 18,
  },
  verificationBannerCta: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  jobCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  offlineCard: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    marginBottom: 16,
  },
  offlineText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyState: {
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  jobCard: {
    borderRadius: 20,
    padding: 22,
    marginBottom: 18,
    position: 'relative',
  },
  urgentBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgentText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  jobInfo: {
    flex: 1,
  },
  jobId: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  timeAgo: {
    fontSize: 12,
  },
  rewardContainer: {
    alignItems: 'flex-end',
  },
  rewardAmount: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 2,
  },
  rewardLabel: {
    fontSize: 12,
  },
  jobDetails: {
    marginBottom: 16,
  },
  sizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sizeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  sizeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  senderName: {
    fontSize: 14,
  },
  addressContainer: {
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  addressDivider: {
    width: 2,
    height: 16,
    backgroundColor: '#E5E7EB',
    marginLeft: 8,
    marginBottom: 8,
  },
  jobMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    marginLeft: 6,
  },
  jobActions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
    backgroundColor: '#fff',
  },
  rejectText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
  },
  acceptText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
  },
});

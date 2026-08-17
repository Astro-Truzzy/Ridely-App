import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated from 'react-native-reanimated';
import { ArrowLeft, User, Phone, Mail, Car, Shield, FileText, Settings, LogOut, CreditCard as Edit3, CircleCheck as CheckCircle, Clock, ChevronRight, Lock, XCircle } from 'lucide-react-native';
import { router, type Href, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { useAlert } from '@/contexts/AlertContext';
import { staggeredCardEnter } from '@/lib/riderAnimations';
import { AnimatedPressable } from '@/components/rider/AnimatedPressable';
import { supabase } from '@/lib/supabase';

interface RiderProfile {
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  rating: number;
  totalDeliveries: number;
  memberSince: string;
  vehicleType: string;
  plateNumber: string;
  verificationStatus: 'not_submitted' | 'pending' | 'verified' | 'rejected';
}

function riderRowToProfile(row: any, authEmail?: string | null): RiderProfile {
  const createdAt = row?.created_at ? new Date(row.created_at) : new Date();
  const memberSince = createdAt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const rawStatus = row?.account_verification_status;
  return {
    name: row?.full_name ?? 'Rider',
    email: authEmail ?? row?.email ?? '—',
    phone: row?.phone ?? '—',
    avatarUrl: row?.avatar_url ?? null,
    rating: typeof row?.rating === 'number' ? row.rating : 0,
    totalDeliveries: typeof row?.total_deliveries === 'number' ? row.total_deliveries : 0,
    memberSince,
    vehicleType: row?.vehicle_type ?? '—',
    plateNumber: row?.plate_number ?? '—',
    verificationStatus:
      rawStatus === 'pending' || rawStatus === 'verified' || rawStatus === 'rejected'
        ? rawStatus
        : 'not_submitted',
  };
}

export default function RiderProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user, userProfile, loading: authLoading, signOut, refreshProfile } = useAuth();
  const [isAvailable, setIsAvailable] = useState(false);

  const profile = userProfile ? riderRowToProfile(userProfile, user?.email) : null;
  const { showAlert } = useAlert();
  const { animations: animationsEnabled } = useAppSettings();
  const enterCard = (i: number) => (animationsEnabled ? staggeredCardEnter(i) : undefined);

  useEffect(() => {
    const avail = (userProfile as { is_available?: boolean } | null)?.is_available;
    if (typeof avail === 'boolean') setIsAvailable(avail);
  }, [userProfile]);

  useFocusEffect(
    useCallback(() => {
      refreshProfile();
    }, [refreshProfile])
  );

  const handleAvailabilityToggle = async (value: boolean) => {
    if (!user?.id) return;
    setIsAvailable(value);
    try {
      await (supabase as any).from('riders').update({ is_available: value, is_online: value }).eq('id', user.id);
      await refreshProfile();
    } catch (e) {
      setIsAvailable(!value);
    }
  };

  const profileActions = [
    {
      icon: Edit3,
      title: 'Edit Profile',
      subtitle: 'Update personal information',
      onPress: () => router.push('/(rider)/edit-profile' as Href),
    },
    {
      icon: Car,
      title: 'Vehicle Information',
      subtitle: 'Update vehicle details',
      onPress: () => router.push('/(rider)/vehicle-information' as Href),
    },
    {
      icon: FileText,
      title: 'Documents',
      subtitle: 'Apply for verification & manage documents',
      onPress: () => router.push('/(rider)/apply-verification' as Href),
    },
    {
      icon: Lock,
      title: 'Withdrawal PIN',
      subtitle: 'Set or change your 4-digit payout PIN',
      onPress: () => router.push('/(rider)/withdrawal-pin' as Href),
    },
    {
      icon: Settings,
      title: 'Settings',
      subtitle: 'App preferences and notifications',
      onPress: () => router.push('/(rider)/settings'),
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle size={16} color="#10B981" strokeWidth={2} />;
      case 'pending':
      case 'not_submitted':
        return <Clock size={16} color={status === 'not_submitted' ? '#6B7280' : '#FFC947'} strokeWidth={2} />;
      case 'rejected':
        return <XCircle size={16} color="#EF4444" strokeWidth={2} />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return '#10B981';
      case 'pending':
        return '#FFC947';
      case 'not_submitted':
        return '#6B7280';
      case 'rejected':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: RiderProfile['verificationStatus']) => {
    switch (status) {
      case 'verified':
        return 'Verified';
      case 'pending':
        return 'Under review';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Not submitted';
    }
  };

  const handleLogout = () => {
    showAlert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/welcome');
          },
        },
      ]
    );
  };

  if (authLoading || !profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>Rider Profile</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading profile…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Header */}
      <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
        <AnimatedPressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.colors.text }]}>Rider Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <Animated.View
          entering={enterCard(0)}
          style={[styles.profileCard, { backgroundColor: theme.colors.surface }, theme.shadows.large]}
        >
          <View style={styles.profileHeader}>
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.avatarText}>
                  {profile.name.split(' ').map((n) => n[0]).join('')}
                </Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={[styles.name, { color: theme.colors.text }]}>{profile.name}</Text>
              <Text style={[styles.email, { color: theme.colors.textSecondary }]}>{profile.email}</Text>
              <Text style={[styles.phone, { color: theme.colors.textSecondary }]}>{profile.phone}</Text>
            </View>
            <View style={styles.availabilityToggle}>
              <Text style={[styles.availabilityLabel, { color: theme.colors.textSecondary }]}>Available</Text>
              <Switch
                value={isAvailable}
                onValueChange={handleAvailabilityToggle}
                trackColor={{ false: theme.colors.border, true: `${theme.colors.success}50` }}
                thumbColor={isAvailable ? theme.colors.success : theme.colors.textTertiary}
              />
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>{profile.rating}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>{profile.totalDeliveries}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Deliveries</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>Member</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{profile.memberSince}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Vehicle Info */}
        <Animated.View
          entering={enterCard(1)}
          style={[styles.vehicleCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Vehicle Information</Text>
          
          <View style={styles.vehicleInfo}>
            <View style={styles.vehicleRow}>
              <Car size={20} color={theme.colors.primary} strokeWidth={2} />
              <View style={styles.vehicleDetails}>
                <Text style={[styles.vehicleLabel, { color: theme.colors.textSecondary }]}>Vehicle</Text>
                <Text style={[styles.vehicleValue, { color: theme.colors.text }]}>{profile.vehicleType}</Text>
              </View>
            </View>
            
            <View style={styles.vehicleRow}>
              <FileText size={20} color={theme.colors.primary} strokeWidth={2} />
              <View style={styles.vehicleDetails}>
                <Text style={[styles.vehicleLabel, { color: theme.colors.textSecondary }]}>Plate Number</Text>
                <Text style={[styles.vehicleValue, { color: theme.colors.text }]}>{profile.plateNumber}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Verification Status */}
        <Animated.View
          entering={enterCard(2)}
          style={[styles.verificationCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}
        >
          <View style={styles.verificationHeader}>
            <View style={styles.verificationTitleWrap}>
              <Shield size={20} color={theme.colors.primary} strokeWidth={2} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 0 }]}>Verification Status</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: `${getStatusColor(profile.verificationStatus)}20` }]}>
              {getStatusIcon(profile.verificationStatus)}
              <Text style={[styles.statusPillText, { color: getStatusColor(profile.verificationStatus) }]}>
                {getStatusLabel(profile.verificationStatus)}
              </Text>
            </View>
          </View>
          <Text style={[styles.verificationMessage, { color: theme.colors.textSecondary }]}>
            {profile.verificationStatus === 'verified'
              ? 'Your documents have been approved. You can accept delivery requests.'
              : profile.verificationStatus === 'rejected'
                ? 'Your application was rejected. Open Documents to see details and re-upload.'
                : profile.verificationStatus === 'pending'
                  ? 'Your documents are being reviewed by our team.'
                  : 'Upload the required documents to start accepting delivery requests.'}
          </Text>
          <AnimatedPressable
            style={[styles.verificationLink, { backgroundColor: `${theme.colors.primary}10` }]}
            onPress={() => router.push('/(rider)/apply-verification' as Href)}
          >
            <FileText size={16} color={theme.colors.primary} strokeWidth={2} />
            <Text style={[styles.verificationLinkText, { color: theme.colors.primary }]}>
              {profile.verificationStatus === 'not_submitted' ? 'Apply for verification' : 'View documents'}
            </Text>
          </AnimatedPressable>
        </Animated.View>

        {/* Profile Actions */}
        <Animated.View
          entering={enterCard(3)}
          style={[styles.actionsCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}
        >
          {profileActions.map((action, index) => (
            <AnimatedPressable
              key={index}
              style={[
                styles.actionItem,
                index < profileActions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }
              ]}
              onPress={action.onPress}
            >
              <View style={[styles.actionIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
                <action.icon size={20} color={theme.colors.primary} strokeWidth={2} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={[styles.actionTitle, { color: theme.colors.text }]}>{action.title}</Text>
                <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>{action.subtitle}</Text>
              </View>
              <ChevronRight size={20} color={theme.colors.textTertiary} strokeWidth={2} />
            </AnimatedPressable>
          ))}
        </Animated.View>

        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <AnimatedPressable
            style={[styles.logoutButton, { backgroundColor: theme.colors.surface, borderColor: `${theme.colors.error}30` }, theme.shadows.medium]}
            onPress={handleLogout}
          >
            <LogOut size={20} color={theme.colors.error} strokeWidth={2} />
            <Text style={[styles.logoutText, { color: theme.colors.error }]}>Logout</Text>
          </AnimatedPressable>
        </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  profileCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    marginBottom: 2,
  },
  phone: {
    fontSize: 14,
  },
  availabilityToggle: {
    alignItems: 'center',
  },
  availabilityLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  vehicleCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  vehicleInfo: {
    gap: 16,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleDetails: {
    marginLeft: 16,
    flex: 1,
  },
  vehicleLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  vehicleValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  verificationCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  verificationTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  verificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 16,
  },
  verificationLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  verificationLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionsCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
  },
  logoutContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Edit3,
  Camera,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  Star,
  Shield,
  ChevronRight,
  Wallet,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { useWallet } from '@/hooks/useWallet';
import { pickProfileImage, uploadAvatar } from '@/lib/avatarUpload';

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  avatar: string | null;
  rating: number;
  totalDeliveries: number;
  memberSince: string;
  verified: boolean;
}

function formatMemberSince(createdAt?: string | null): string {
  if (!createdAt) return '—';
  const date = new Date(createdAt);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { userProfile, user, updateProfile } = useAuth();
  const { showAlert } = useAlert();
  const { balance: walletBalance } = useWallet();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    name: userProfile?.full_name || 'User',
    email: userProfile?.email || '',
    phone: userProfile?.phone || '',
    avatar: userProfile?.avatar_url || null,
    rating: 4.8,
    totalDeliveries: userProfile?.total_deliveries || 0,
    memberSince: formatMemberSince((userProfile as { created_at?: string } | null)?.created_at),
    verified: true,
  });

  // Update profile when userProfile changes
  React.useEffect(() => {
    if (userProfile) {
      setProfile({
        name: userProfile.full_name || 'User',
        email: userProfile.email || '',
        phone: userProfile.phone || '',
        avatar: userProfile.avatar_url || null,
        rating: 4.8,
        totalDeliveries: userProfile.total_deliveries || 0,
        memberSince: formatMemberSince((userProfile as { created_at?: string } | null)?.created_at),
        verified: true,
      });
    }
  }, [userProfile]);

  const profileActions = [
    {
      icon: Edit3,
      title: 'Edit Profile',
      subtitle: 'Update your personal information',
      onPress: () => router.push('/profile/edit'),
    },
    {
      icon: Wallet,
      title: 'My Wallet',
      subtitle:
        walletBalance != null
          ? `Balance: ₦${Number(walletBalance).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
          : 'View balance, fund and withdraw',
      onPress: () => router.push('/profile/wallet'),
    },
    {
      icon: CreditCard,
      title: 'Payment Methods',
      subtitle: 'Manage cards and payment options',
      onPress: () => router.push('/profile/payment-methods'),
    },
    {
      icon: MapPin,
      title: 'Saved Addresses',
      subtitle: 'Home, work, and favorite locations',
      onPress: () => router.push('/profile/saved-addresses'),
    },
    {
      icon: Star,
      title: 'Rate & Review',
      subtitle: 'Rate your completed deliveries',
      onPress: () => router.push('/(tabs)/bookings'),
    },
  ];

  const handleImageUpload = async () => {
    const choice = await new Promise<'camera' | 'gallery' | 'remove' | null>(
      (resolve) => {
        showAlert('Update Profile Picture', 'Choose an option', [
          { text: 'Camera', onPress: () => resolve('camera') },
          { text: 'Gallery', onPress: () => resolve('gallery') },
          {
            text: 'Remove Photo',
            onPress: () => resolve('remove'),
            style: 'destructive',
          },
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        ]);
      },
    );
    if (choice === 'remove') {
      try {
        await updateProfile({ avatar_url: null });
        setProfile((prev) => ({ ...prev, avatar: null }));
      } catch (e) {
        showAlert(
          'Error',
          e instanceof Error ? e.message : 'Could not remove photo.',
        );
      }
      return;
    }
    if (!choice || !user?.id) return;
    setUploadingAvatar(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 350));
      const picked = await pickProfileImage(choice);
      if (!picked) return;
      const avatarUrl = await uploadAvatar(user.id, picked);
      await updateProfile({ avatar_url: avatarUrl });
      setProfile((prev) => ({ ...prev, avatar: avatarUrl }));
    } catch (e) {
      showAlert(
        'Error',
        e instanceof Error ? e.message : 'Could not update profile picture.',
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
    },
    profileCard: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: 20,
      borderRadius: 20,
      padding: 24,
      marginBottom: 24,
      ...theme.shadows.large,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },
    avatarContainer: {
      position: 'relative',
      marginRight: 20,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },
    avatarOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.surface,
    },
    cameraIcon: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: theme.colors.surface,
    },
    profileInfo: {
      flex: 1,
    },
    nameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    name: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      marginRight: 8,
    },
    email: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: 4,
    },
    phone: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: 24,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    statLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginLeft: 4,
    },
    statDivider: {
      width: 1,
      height: 40,
      backgroundColor: theme.colors.border,
    },
    actionsContainer: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: 20,
      borderRadius: 16,
      marginBottom: 24,
      ...theme.shadows.medium,
    },
    actionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    actionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.card,
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
      color: theme.colors.text,
      marginBottom: 4,
    },
    actionSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    accountInfo: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: 20,
      borderRadius: 16,
      padding: 20,
      marginBottom: 32,
      ...theme.shadows.medium,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 20,
    },
    infoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    infoContent: {
      marginLeft: 16,
      flex: 1,
    },
    infoLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 4,
    },
    infoValue: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: 20 + insets.top }]}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handleImageUpload}
              disabled={uploadingAvatar}
            >
              {profile.avatar ? (
                <Image source={{ uri: profile.avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {profile.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </Text>
                </View>
              )}
              {uploadingAvatar && (
                <View
                  style={[
                    styles.avatarOverlay,
                    { backgroundColor: 'rgba(0,0,0,0.4)' },
                  ]}
                >
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}
              <View style={styles.cameraIcon}>
                <Camera size={16} color="#FFFFFF" strokeWidth={2} />
              </View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <View style={styles.nameContainer}>
                <Text style={[styles.name, { color: theme.colors.text }]}>
                  {profile.name}
                </Text>
              </View>
              <Text
                style={[styles.email, { color: theme.colors.textSecondary }]}
              >
                {profile.email}
              </Text>
              <Text
                style={[styles.phone, { color: theme.colors.textSecondary }]}
              >
                {profile.phone}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.rating}</Text>
              <View style={styles.statLabelContainer}>
                <Star
                  size={16}
                  color="#FFC947"
                  fill="#FFC947"
                  strokeWidth={2}
                />
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.totalDeliveries}</Text>
              <Text style={styles.statLabel}>Deliveries</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>Member</Text>
              <Text style={styles.statLabel}>{profile.memberSince}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {profileActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionItem}
              onPress={action.onPress}
            >
              <View style={styles.actionIcon}>
                <action.icon
                  size={24}
                  color={theme.colors.primary}
                  strokeWidth={2}
                />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
              </View>
              <ChevronRight
                size={20}
                color={theme.colors.textTertiary}
                strokeWidth={2}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Account Info */}
        <View style={styles.accountInfo}>
          <Text style={styles.sectionTitle}>Account Information</Text>

          <View style={styles.infoItem}>
            <Mail
              size={20}
              color={theme.colors.textSecondary}
              strokeWidth={2}
            />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{profile.email}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Phone
              size={20}
              color={theme.colors.textSecondary}
              strokeWidth={2}
            />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{profile.phone}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Shield size={20} color="#10B981" strokeWidth={2} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Verification Status</Text>
              <Text style={[styles.infoValue, { color: '#10B981' }]}>
                {profile.verified ? 'Verified Account' : 'Pending Verification'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  Alert,
} from 'react-native';
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
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

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

export default function ProfileScreen() {
  const { theme } = useTheme();

  const [profile, setProfile] = useState<UserProfile>({
    name: 'Williams Trust',
    email: 'Astro.dev@email.com',
    phone: '+234 916 503 2925',
    avatar: null,
    rating: 4.8,
    totalDeliveries: 47,
    memberSince: 'July 2025',
    verified: true,
  });

  const profileActions = [
    {
      icon: Edit3,
      title: 'Edit Profile',
      subtitle: 'Update your personal information',
      onPress: () => router.push('/profile/edit'),
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
      onPress: () => Alert.alert('Feature', 'Saved addresses coming soon!'),
    },
    {
      icon: Star,
      title: 'Rate & Review',
      subtitle: 'Help improve our service',
      onPress: () => Alert.alert('Feature', 'Rating system coming soon!'),
    },
  ];

  const handleImageUpload = () => {
    Alert.alert(
      'Update Profile Picture',
      'Choose an option',
      [
        { text: 'Camera', onPress: () => console.log('Camera selected') },
        { text: 'Gallery', onPress: () => console.log('Gallery selected') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Profile</Text>
        </View>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
          <View style={styles.profileHeader}>
            <TouchableOpacity style={styles.avatarContainer} onPress={handleImageUpload}>
              {profile.avatar ? (
                <Image source={{ uri: profile.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                  <Text style={[styles.avatarText, { color: theme.colors.black }]}>
                    {profile.name.split(' ').map(n => n[0]).join('')}
                  </Text>
                </View>
              )}
              <View style={[styles.cameraIcon, { backgroundColor: theme.colors.warning, borderColor: theme.colors.surface }]}>
                <Camera size={16} color={theme.colors.black} strokeWidth={2} />
              </View>
            </TouchableOpacity>

            <View style={styles.profileInfo}>
              <View style={styles.nameContainer}>
                <Text style={[styles.name, { color: theme.colors.text }]}>{profile.name}</Text>
                {profile.verified && (
                  <Shield size={20} color={theme.colors.success} strokeWidth={2} />
                )}
              </View>
              <Text style={[styles.email, { color: theme.colors.textSecondary }]}>{profile.email}</Text>
              <Text style={[styles.phone, { color: theme.colors.textSecondary }]}>{profile.phone}</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={[styles.statsContainer, { borderTopColor: theme.colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>{profile.rating}</Text>
              <View style={styles.statLabelContainer}>
                <Star size={16} color={theme.colors.warning} fill={theme.colors.warning} strokeWidth={2} />
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Rating</Text>
              </View>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>{profile.totalDeliveries}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Deliveries</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>Member</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{profile.memberSince}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={[styles.actionsContainer, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
          {profileActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.actionItem, { borderBottomColor: theme.colors.border }]}
              onPress={action.onPress}>
              <View style={[styles.actionIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                <action.icon size={24} color={theme.colors.primary} strokeWidth={2} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={[styles.actionTitle, { color: theme.colors.text }]}>{action.title}</Text>
                <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>{action.subtitle}</Text>
              </View>
              <ChevronRight size={20} color={theme.colors.textTertiary} strokeWidth={2} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Account Info */}
        <View style={[styles.accountInfo, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Account Information</Text>
          
          <View style={[styles.infoItem, { borderBottomColor: theme.colors.border }]}>
            <Mail size={20} color={theme.colors.textTertiary} strokeWidth={2} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Email</Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>{profile.email}</Text>
            </View>
          </View>
          
          <View style={[styles.infoItem, { borderBottomColor: theme.colors.border }]}>
            <Phone size={20} color={theme.colors.textTertiary} strokeWidth={2} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Phone</Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>{profile.phone}</Text>
            </View>
          </View>
          
          <View style={[styles.infoItem, { borderBottomColor: theme.colors.border }]}>
            <Shield size={20} color={theme.colors.success} strokeWidth={2} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Verification Status</Text>
              <Text style={[styles.infoValue, { color: theme.colors.success }]}>{profile.verified ? 'Verified Account' : 'Pending Verification'}</Text>
            </View>
          </View>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  profileCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
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
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
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
    marginRight: 8,
  },
  email: {
    fontSize: 16,
    marginBottom: 4,
  },
  phone: {
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 24,
    borderTopWidth: 1,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    marginLeft: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  actionsContainer: {
    marginHorizontal: 20,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  accountInfo: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoContent: {
    marginLeft: 16,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
});
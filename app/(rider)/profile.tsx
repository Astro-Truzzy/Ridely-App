import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Switch,
} from 'react-native';
import { ArrowLeft, User, Phone, Mail, Car, Shield, FileText, Settings, LogOut, CreditCard as Edit3, CircleCheck as CheckCircle, Clock, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

interface RiderProfile {
  name: string;
  email: string;
  phone: string;
  rating: number;
  totalDeliveries: number;
  memberSince: string;
  vehicleType: string;
  plateNumber: string;
  licenseStatus: 'verified' | 'pending' | 'expired';
  insuranceStatus: 'verified' | 'pending' | 'expired';
  backgroundCheck: 'verified' | 'pending' | 'failed';
}

export default function RiderProfileScreen() {
  const { theme } = useTheme();
  const [isAvailable, setIsAvailable] = useState(true);
  
  const [profile] = useState<RiderProfile>({
    name: 'Mike Johnson',
    email: 'mike.johnson@email.com',
    phone: '+1 (555) 987-6543',
    rating: 4.9,
    totalDeliveries: 342,
    memberSince: 'March 2024',
    vehicleType: 'Honda CBR 150R',
    plateNumber: 'ABC-1234',
    licenseStatus: 'verified',
    insuranceStatus: 'verified',
    backgroundCheck: 'verified',
  });

  const profileActions = [
    {
      icon: Edit3,
      title: 'Edit Profile',
      subtitle: 'Update personal information',
      onPress: () => Alert.alert('Feature', 'Edit profile coming soon!'),
    },
    {
      icon: Car,
      title: 'Vehicle Information',
      subtitle: 'Update vehicle details',
      onPress: () => Alert.alert('Feature', 'Vehicle info coming soon!'),
    },
    {
      icon: FileText,
      title: 'Documents',
      subtitle: 'Manage verification documents',
      onPress: () => Alert.alert('Feature', 'Documents management coming soon!'),
    },
    {
      icon: Settings,
      title: 'Settings',
      subtitle: 'App preferences and notifications',
      onPress: () => router.push('/(tabs)/settings'),
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle size={16} color="#10B981" strokeWidth={2} />;
      case 'pending':
        return <Clock size={16} color="#FFC947" strokeWidth={2} />;
      case 'expired':
      case 'failed':
        return <Shield size={16} color="#EF4444" strokeWidth={2} />;
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
      case 'expired':
      case 'failed':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Success', 'You have been logged out');
            router.replace('/(auth)/welcome');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Rider Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.colors.surface }, theme.shadows.large]}>
          <View style={styles.profileHeader}>
            <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.avatarText}>
                {profile.name.split(' ').map(n => n[0]).join('')}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.name, { color: theme.colors.text }]}>{profile.name}</Text>
              <Text style={[styles.email, { color: theme.colors.textSecondary }]}>{profile.email}</Text>
              <Text style={[styles.phone, { color: theme.colors.textSecondary }]}>{profile.phone}</Text>
            </View>
            <View style={styles.availabilityToggle}>
              <Text style={[styles.availabilityLabel, { color: theme.colors.textSecondary }]}>Available</Text>
              <Switch
                value={isAvailable}
                onValueChange={setIsAvailable}
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
        </View>

        {/* Vehicle Info */}
        <View style={[styles.vehicleCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
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
        </View>

        {/* Verification Status */}
        <View style={[styles.verificationCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Verification Status</Text>
          
          <View style={styles.verificationList}>
            <View style={styles.verificationItem}>
              <View style={styles.verificationInfo}>
                {getStatusIcon(profile.licenseStatus)}
                <Text style={[styles.verificationLabel, { color: theme.colors.text }]}>Driver's License</Text>
              </View>
              <Text style={[styles.verificationStatus, { color: getStatusColor(profile.licenseStatus) }]}>
                {profile.licenseStatus.charAt(0).toUpperCase() + profile.licenseStatus.slice(1)}
              </Text>
            </View>
            
            <View style={styles.verificationItem}>
              <View style={styles.verificationInfo}>
                {getStatusIcon(profile.insuranceStatus)}
                <Text style={[styles.verificationLabel, { color: theme.colors.text }]}>Vehicle Insurance</Text>
              </View>
              <Text style={[styles.verificationStatus, { color: getStatusColor(profile.insuranceStatus) }]}>
                {profile.insuranceStatus.charAt(0).toUpperCase() + profile.insuranceStatus.slice(1)}
              </Text>
            </View>
            
            <View style={styles.verificationItem}>
              <View style={styles.verificationInfo}>
                {getStatusIcon(profile.backgroundCheck)}
                <Text style={[styles.verificationLabel, { color: theme.colors.text }]}>Background Check</Text>
              </View>
              <Text style={[styles.verificationStatus, { color: getStatusColor(profile.backgroundCheck) }]}>
                {profile.backgroundCheck.charAt(0).toUpperCase() + profile.backgroundCheck.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Profile Actions */}
        <View style={[styles.actionsCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
          {profileActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.actionItem,
                index < profileActions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }
              ]}
              onPress={action.onPress}>
              <View style={[styles.actionIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
                <action.icon size={20} color={theme.colors.primary} strokeWidth={2} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={[styles.actionTitle, { color: theme.colors.text }]}>{action.title}</Text>
                <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>{action.subtitle}</Text>
              </View>
              <ChevronRight size={20} color={theme.colors.textTertiary} strokeWidth={2} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: theme.colors.surface, borderColor: `${theme.colors.error}30` }, theme.shadows.medium]}
            onPress={handleLogout}>
            <LogOut size={20} color={theme.colors.error} strokeWidth={2} />
            <Text style={[styles.logoutText, { color: theme.colors.error }]}>Logout</Text>
          </TouchableOpacity>
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
  scrollView: {
    flex: 1,
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
  verificationList: {
    gap: 16,
  },
  verificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  verificationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 12,
  },
  verificationStatus: {
    fontSize: 12,
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
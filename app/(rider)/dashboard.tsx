import React, { useState, useEffect } from 'react';
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
import { Package, MapPin, DollarSign, Clock, User, Bell, Settings, Navigation, CircleCheck as CheckCircle, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

interface DeliveryRequest {
  id: string;
  parcelSize: 'small' | 'medium' | 'large';
  pickupAddress: string;
  dropoffAddress: string;
  distance: number;
  estimatedTime: string;
  reward: number;
  senderName: string;
  urgency: 'normal' | 'urgent';
  createdAt: Date;
}

export default function RiderDashboard() {
  const { theme } = useTheme();
  const [isOnline, setIsOnline] = useState(true);
  const [riderStats] = useState({
    activeJobs: 1,
    completedToday: 8,
    todayEarnings: 156.75,
    rating: 4.9,
  });

  const [availableJobs, setAvailableJobs] = useState<DeliveryRequest[]>([
    {
      id: 'REQ001',
      parcelSize: 'medium',
      pickupAddress: '123 Main St, Downtown',
      dropoffAddress: '456 Oak Ave, Uptown',
      distance: 3.2,
      estimatedTime: '25 mins',
      reward: 18.50,
      senderName: 'John Doe',
      urgency: 'normal',
      createdAt: new Date(Date.now() - 300000),
    },
    {
      id: 'REQ002',
      parcelSize: 'small',
      pickupAddress: 'City Mall, Level 2',
      dropoffAddress: '789 Pine St, Midtown',
      distance: 1.8,
      estimatedTime: '15 mins',
      reward: 12.25,
      senderName: 'Sarah Wilson',
      urgency: 'urgent',
      createdAt: new Date(Date.now() - 180000),
    },
    {
      id: 'REQ003',
      parcelSize: 'large',
      pickupAddress: 'Office Complex A, Floor 5',
      dropoffAddress: 'Residential Area, Block C',
      distance: 5.7,
      estimatedTime: '35 mins',
      reward: 24.75,
      senderName: 'Mike Johnson',
      urgency: 'normal',
      createdAt: new Date(Date.now() - 120000),
    },
  ]);

  const handleAcceptJob = (job: DeliveryRequest) => {
    Alert.alert(
      'Accept Delivery',
      `Accept delivery for $${job.reward}?\n\nPickup: ${job.pickupAddress}\nDropoff: ${job.dropoffAddress}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () => {
            setAvailableJobs(prev => prev.filter(j => j.id !== job.id));
            router.push({
              pathname: '/(rider)/active-delivery',
              params: { jobId: job.id, jobData: JSON.stringify(job) },
            });
          },
        },
      ]
    );
  };

  const handleRejectJob = (jobId: string) => {
    setAvailableJobs(prev => prev.filter(j => j.id !== jobId));
  };

  const getSizeColor = (size: string) => {
    switch (size) {
      case 'small': return '#10B981';
      case 'medium': return '#FFC947';
      case 'large': return '#EF4444';
      default: return theme.colors.textSecondary;
    }
  };

  const getTimeAgo = (date: Date) => {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    return `${minutes}m ago`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: theme.colors.text }]}>Good morning, Rider! 🏍️</Text>
            <View style={styles.onlineStatus}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]} />
              <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
              <Switch
                value={isOnline}
                onValueChange={setIsOnline}
                trackColor={{ false: theme.colors.border, true: `${theme.colors.success}50` }}
                thumbColor={isOnline ? theme.colors.success : theme.colors.textTertiary}
                style={styles.onlineSwitch}
              />
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}
              onPress={() => router.push('/(rider)/notifications')}>
              <Bell size={24} color={theme.colors.primary} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}
              onPress={() => router.push('/(rider)/profile')}>
              <User size={24} color={theme.colors.primary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
            <Package size={24} color={theme.colors.primary} strokeWidth={2} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{riderStats.activeJobs}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Active Jobs</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
            <CheckCircle size={24} color={theme.colors.success} strokeWidth={2} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{riderStats.completedToday}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Completed Today</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
            <DollarSign size={24} color={theme.colors.success} strokeWidth={2} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>${riderStats.todayEarnings}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Today's Earnings</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }, theme.shadows.medium]}
            onPress={() => router.push('/(rider)/earnings')}>
            <DollarSign size={20} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.actionText}>View Earnings</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.success }, theme.shadows.medium]}
            onPress={() => Alert.alert('Navigation', 'Opening navigation app...')}>
            <Navigation size={20} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.actionText}>Navigate</Text>
          </TouchableOpacity>
        </View>

        {/* Available Jobs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Available Deliveries</Text>
            <Text style={[styles.jobCount, { color: theme.colors.textSecondary }]}>
              {availableJobs.length} jobs
            </Text>
          </View>

          {!isOnline && (
            <View style={[styles.offlineCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.warning }]}>
              <Text style={[styles.offlineText, { color: theme.colors.warning }]}>
                You're offline. Turn on availability to see delivery requests.
              </Text>
            </View>
          )}

          {isOnline && availableJobs.length === 0 && (
            <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
              <Package size={48} color={theme.colors.textTertiary} strokeWidth={2} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No jobs available</Text>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                New delivery requests will appear here
              </Text>
            </View>
          )}

          {isOnline && availableJobs.map((job) => (
            <View key={job.id} style={[styles.jobCard, { backgroundColor: theme.colors.surface }, theme.shadows.large]}>
              {job.urgency === 'urgent' && (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentText}>URGENT</Text>
                </View>
              )}
              
              <View style={styles.jobHeader}>
                <View style={styles.jobInfo}>
                  <Text style={[styles.jobId, { color: theme.colors.text }]}>#{job.id}</Text>
                  <Text style={[styles.timeAgo, { color: theme.colors.textSecondary }]}>
                    {getTimeAgo(job.createdAt)}
                  </Text>
                </View>
                <View style={styles.rewardContainer}>
                  <Text style={[styles.rewardAmount, { color: theme.colors.success }]}>${job.reward}</Text>
                  <Text style={[styles.rewardLabel, { color: theme.colors.textSecondary }]}>Reward</Text>
                </View>
              </View>

              <View style={styles.jobDetails}>
                <View style={styles.sizeContainer}>
                  <View style={[styles.sizeIndicator, { backgroundColor: getSizeColor(job.parcelSize) }]} />
                  <Text style={[styles.sizeText, { color: theme.colors.text }]}>
                    {job.parcelSize.charAt(0).toUpperCase() + job.parcelSize.slice(1)} Package
                  </Text>
                </View>
                
                <Text style={[styles.senderName, { color: theme.colors.textSecondary }]}>
                  From: {job.senderName}
                </Text>
              </View>

              <View style={styles.addressContainer}>
                <View style={styles.addressRow}>
                  <MapPin size={16} color={theme.colors.success} strokeWidth={2} />
                  <Text style={[styles.addressText, { color: theme.colors.text }]} numberOfLines={1}>
                    {job.pickupAddress}
                  </Text>
                </View>
                <View style={styles.addressDivider} />
                <View style={styles.addressRow}>
                  <MapPin size={16} color={theme.colors.error} strokeWidth={2} />
                  <Text style={[styles.addressText, { color: theme.colors.text }]} numberOfLines={1}>
                    {job.dropoffAddress}
                  </Text>
                </View>
              </View>

              <View style={styles.jobMeta}>
                <View style={styles.metaItem}>
                  <Navigation size={16} color={theme.colors.textSecondary} strokeWidth={2} />
                  <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                    {job.distance} km
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Clock size={16} color={theme.colors.textSecondary} strokeWidth={2} />
                  <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                    ~{job.estimatedTime}
                  </Text>
                </View>
              </View>

              <View style={styles.jobActions}>
                <TouchableOpacity
                  style={[styles.rejectButton, { backgroundColor: `${theme.colors.error}20`, borderColor: theme.colors.error }]}
                  onPress={() => handleRejectJob(job.id)}>
                  <X size={20} color={theme.colors.error} strokeWidth={2} />
                  <Text style={[styles.rejectText, { color: theme.colors.error }]}>Reject</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.acceptButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => handleAcceptJob(job)}>
                  <CheckCircle size={20} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.acceptText}>Accept Job</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
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
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
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
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
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
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
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
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  rejectText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
  },
});
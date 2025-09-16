import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  TextInput,
} from 'react-native';
import { ArrowLeft, Navigation, Phone, MessageCircle, MapPin, Clock, Package, CircleCheck as CheckCircle, User } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

type DeliveryStatus = 'heading_to_pickup' | 'at_pickup' | 'picked_up' | 'heading_to_dropoff' | 'at_dropoff' | 'delivered';

export default function ActiveDeliveryScreen() {
  const { theme } = useTheme();
  const { jobId, jobData } = useLocalSearchParams<{ jobId: string; jobData: string }>();
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('heading_to_pickup');
  const [deliveryOTP, setDeliveryOTP] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);

  const job = jobData ? JSON.parse(jobData) : null;

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = (status: DeliveryStatus) => {
    switch (status) {
      case 'heading_to_pickup':
        return 'Heading to Pickup';
      case 'at_pickup':
        return 'At Pickup Location';
      case 'picked_up':
        return 'Package Picked Up';
      case 'heading_to_dropoff':
        return 'Heading to Dropoff';
      case 'at_dropoff':
        return 'At Dropoff Location';
      case 'delivered':
        return 'Delivered';
      default:
        return 'In Progress';
    }
  };

  const getNextAction = () => {
    switch (deliveryStatus) {
      case 'heading_to_pickup':
        return { text: 'Arrived at Pickup', action: () => setDeliveryStatus('at_pickup') };
      case 'at_pickup':
        return { text: 'Mark as Picked Up', action: () => setDeliveryStatus('picked_up') };
      case 'picked_up':
        return { text: 'Start Delivery', action: () => setDeliveryStatus('heading_to_dropoff') };
      case 'heading_to_dropoff':
        return { text: 'Arrived at Dropoff', action: () => setDeliveryStatus('at_dropoff') };
      case 'at_dropoff':
        return { text: 'Complete Delivery', action: handleCompleteDelivery };
      default:
        return null;
    }
  };

  const handleCompleteDelivery = () => {
    Alert.alert(
      'Complete Delivery',
      'Enter the delivery OTP provided by the receiver to complete this delivery.',
      [
        {
          text: 'Enter OTP',
          onPress: () => {
            Alert.prompt(
              'Delivery OTP',
              'Enter the 4-digit OTP from receiver:',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Confirm',
                  onPress: (otp) => {
                    if (otp && otp.length === 4) {
                      setDeliveryStatus('delivered');
                      Alert.alert(
                        'Delivery Completed! 🎉',
                        `You've earned $${job?.reward}!\n\nNet earnings: $${(job?.reward * 0.85).toFixed(2)} (after 15% Ridely fee)`,
                        [
                          {
                            text: 'View Earnings',
                            onPress: () => router.replace('/(rider)/earnings'),
                          },
                          {
                            text: 'Back to Dashboard',
                            onPress: () => router.replace('/(rider)/dashboard'),
                          },
                        ]
                      );
                    } else {
                      Alert.alert('Error', 'Please enter a valid 4-digit OTP');
                    }
                  },
                },
              ],
              'plain-text',
              '',
              'numeric'
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleContactSender = () => {
    Alert.alert(
      'Contact Sender',
      `Contact ${job?.senderName}`,
      [
        {
          text: 'Call',
          onPress: () => Alert.alert('Calling', `Calling ${job?.senderName}...`),
        },
        {
          text: 'Message',
          onPress: () => Alert.alert('Message', 'Opening chat...'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleContactReceiver = () => {
    Alert.alert(
      'Contact Receiver',
      'Contact the package receiver',
      [
        {
          text: 'Call',
          onPress: () => Alert.alert('Calling', 'Calling receiver...'),
        },
        {
          text: 'Message',
          onPress: () => Alert.alert('Message', 'Opening chat...'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  if (!job) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.colors.text }]}>Job data not found</Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const nextAction = getNextAction();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Active Delivery</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Map Placeholder */}
      <View style={[styles.mapContainer, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.mapPlaceholder}>
          <Navigation size={48} color={theme.colors.primary} strokeWidth={2} />
          <Text style={[styles.mapText, { color: theme.colors.text }]}>Live Navigation</Text>
          <Text style={[styles.mapSubtext, { color: theme.colors.textSecondary }]}>
            Google Maps integration would show real-time navigation here
          </Text>
        </View>
        
        {/* Status Overlay */}
        <View style={[styles.statusOverlay, { backgroundColor: theme.colors.surface }, theme.shadows.large]}>
          <View style={styles.statusHeader}>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusText, { color: theme.colors.text }]}>{getStatusText(deliveryStatus)}</Text>
              <Text style={[styles.elapsedTime, { color: theme.colors.primary }]}>{formatTime(elapsedTime)}</Text>
            </View>
            <View style={[styles.rewardBadge, { backgroundColor: theme.colors.success }]}>
              <Text style={styles.rewardText}>${job.reward}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Job Details */}
      <View style={[styles.jobDetails, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
        <View style={styles.jobHeader}>
          <Text style={[styles.jobId, { color: theme.colors.text }]}>#{job.id}</Text>
          <View style={styles.sizeIndicator}>
            <Package size={16} color={theme.colors.primary} strokeWidth={2} />
            <Text style={[styles.sizeText, { color: theme.colors.primary }]}>
              {job.parcelSize.charAt(0).toUpperCase() + job.parcelSize.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.addressContainer}>
          <View style={styles.addressRow}>
            <MapPin size={20} color={theme.colors.success} strokeWidth={2} />
            <View style={styles.addressInfo}>
              <Text style={[styles.addressLabel, { color: theme.colors.textSecondary }]}>Pickup</Text>
              <Text style={[styles.addressText, { color: theme.colors.text }]}>{job.pickupAddress}</Text>
            </View>
          </View>
          
          <View style={styles.addressDivider} />
          
          <View style={styles.addressRow}>
            <MapPin size={20} color={theme.colors.error} strokeWidth={2} />
            <View style={styles.addressInfo}>
              <Text style={[styles.addressLabel, { color: theme.colors.textSecondary }]}>Dropoff</Text>
              <Text style={[styles.addressText, { color: theme.colors.text }]}>{job.dropoffAddress}</Text>
            </View>
          </View>
        </View>

        <View style={styles.metaInfo}>
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
      </View>

      {/* Contact Options */}
      <View style={styles.contactContainer}>
        <TouchableOpacity
          style={[styles.contactButton, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}
          onPress={handleContactSender}>
          <User size={20} color={theme.colors.primary} strokeWidth={2} />
          <Text style={[styles.contactText, { color: theme.colors.text }]}>Contact Sender</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.contactButton, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}
          onPress={handleContactReceiver}>
          <Package size={20} color={theme.colors.success} strokeWidth={2} />
          <Text style={[styles.contactText, { color: theme.colors.text }]}>Contact Receiver</Text>
        </TouchableOpacity>
      </View>

      {/* Action Button */}
      {nextAction && deliveryStatus !== 'delivered' && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={nextAction.action}>
            <CheckCircle size={20} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.actionText}>{nextAction.text}</Text>
          </TouchableOpacity>
        </View>
      )}

      {deliveryStatus === 'delivered' && (
        <View style={styles.completedContainer}>
          <View style={[styles.completedCard, { backgroundColor: theme.colors.success }]}>
            <CheckCircle size={32} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.completedText}>Delivery Completed!</Text>
            <Text style={styles.completedSubtext}>
              You earned ${(job.reward * 0.85).toFixed(2)} (net)
            </Text>
          </View>
        </View>
      )}
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
  headerBackButton: {
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
  mapContainer: {
    height: 280,
    position: 'relative',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  mapText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  mapSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  statusOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    borderRadius: 12,
    padding: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  elapsedTime: {
    fontSize: 14,
    fontWeight: '600',
  },
  rewardBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  rewardText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  jobDetails: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  jobId: {
    fontSize: 18,
    fontWeight: '700',
  },
  sizeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  sizeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  addressContainer: {
    marginBottom: 20,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  addressInfo: {
    marginLeft: 12,
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  addressDivider: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginLeft: 10,
    marginBottom: 12,
  },
  metaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 14,
    marginLeft: 6,
  },
  contactContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionContainer: {
    padding: 20,
  },
  actionButton: {
    flexDirection: 'row',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  completedContainer: {
    padding: 20,
  },
  completedCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  completedText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 8,
  },
  completedSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
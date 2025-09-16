import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  MapPin,
  Home,
  Building,
  Clock,
  ChevronRight,
  Search,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';

interface Address {
  id: string;
  label: string;
  address: string;
  icon: any;
}

export default function AddressScreen() {
  const { size } = useLocalSearchParams<{ size: string }>();
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [deliveryTime, setDeliveryTime] = useState<'now' | 'scheduled'>('now');
  const [scheduledTime, setScheduledTime] = useState('');

  const savedAddresses: Address[] = [
    {
      id: '1',
      label: 'Home',
      address: '123 Main Street, Downtown, City',
      icon: Home,
    },
    {
      id: '2',
      label: 'Office',
      address: '456 Business Ave, Corporate District',
      icon: Building,
    },
  ];

  const handleContinue = () => {
    if (!pickupAddress || !dropoffAddress) {
      Alert.alert('Missing Information', 'Please enter both pickup and dropoff addresses');
      return;
    }

    if (deliveryTime === 'scheduled' && !scheduledTime) {
      Alert.alert('Missing Information', 'Please select a scheduled delivery time');
      return;
    }

    router.push({
      pathname: '/booking/pricing',
      params: {
        size,
        pickupAddress,
        dropoffAddress,
        deliveryTime,
        scheduledTime,
      },
    });
  };

  const selectAddress = (address: Address, type: 'pickup' | 'dropoff') => {
    if (type === 'pickup') {
      setPickupAddress(address.address);
    } else {
      setDropoffAddress(address.address);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1F2937" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.title}>Addresses & Time</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressStep, styles.completedStep]} />
            <View style={[styles.progressStep, styles.activeStep]} />
            <View style={styles.progressStep} />
            <View style={styles.progressStep} />
          </View>
          <Text style={styles.progressText}>Step 2 of 4</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Pickup Address */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MapPin size={24} color="#10B981" strokeWidth={2} />
              <Text style={styles.sectionTitle}>Pickup Address</Text>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.addressInput}
                placeholder="Enter pickup address"
                value={pickupAddress}
                onChangeText={setPickupAddress}
                multiline
              />
              <TouchableOpacity style={styles.searchButton}>
                <Search size={20} color="#6B7280" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Saved Addresses */}
            <Text style={styles.savedTitle}>Saved Addresses</Text>
            {savedAddresses.map((address) => (
              <TouchableOpacity
                key={address.id}
                style={styles.savedAddressCard}
                onPress={() => selectAddress(address, 'pickup')}>
                <View style={styles.addressIcon}>
                  <address.icon size={20} color="#5A47FF" strokeWidth={2} />
                </View>
                <View style={styles.addressInfo}>
                  <Text style={styles.addressLabel}>{address.label}</Text>
                  <Text style={styles.addressText}>{address.address}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Dropoff Address */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MapPin size={24} color="#EF4444" strokeWidth={2} />
              <Text style={styles.sectionTitle}>Dropoff Address</Text>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.addressInput}
                placeholder="Enter dropoff address"
                value={dropoffAddress}
                onChangeText={setDropoffAddress}
                multiline
              />
              <TouchableOpacity style={styles.searchButton}>
                <Search size={20} color="#6B7280" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Saved Addresses */}
            <Text style={styles.savedTitle}>Saved Addresses</Text>
            {savedAddresses.map((address) => (
              <TouchableOpacity
                key={address.id}
                style={styles.savedAddressCard}
                onPress={() => selectAddress(address, 'dropoff')}>
                <View style={styles.addressIcon}>
                  <address.icon size={20} color="#5A47FF" strokeWidth={2} />
                </View>
                <View style={styles.addressInfo}>
                  <Text style={styles.addressLabel}>{address.label}</Text>
                  <Text style={styles.addressText}>{address.address}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Delivery Time */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Clock size={24} color="#FFC947" strokeWidth={2} />
              <Text style={styles.sectionTitle}>Delivery Time</Text>
            </View>

            <View style={styles.timeOptions}>
              <TouchableOpacity
                style={[
                  styles.timeOption,
                  deliveryTime === 'now' && styles.selectedTimeOption,
                ]}
                onPress={() => setDeliveryTime('now')}>
                <Text
                  style={[
                    styles.timeOptionText,
                    deliveryTime === 'now' && styles.selectedTimeText,
                  ]}>
                  Deliver Now
                </Text>
                <Text
                  style={[
                    styles.timeOptionSubtext,
                    deliveryTime === 'now' && styles.selectedTimeText,
                  ]}>
                  Pickup within 15-30 mins
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.timeOption,
                  deliveryTime === 'scheduled' && styles.selectedTimeOption,
                ]}
                onPress={() => setDeliveryTime('scheduled')}>
                <Text
                  style={[
                    styles.timeOptionText,
                    deliveryTime === 'scheduled' && styles.selectedTimeText,
                  ]}>
                  Schedule for Later
                </Text>
                <Text
                  style={[
                    styles.timeOptionSubtext,
                    deliveryTime === 'scheduled' && styles.selectedTimeText,
                  ]}>
                  Choose pickup time
                </Text>
              </TouchableOpacity>
            </View>

            {deliveryTime === 'scheduled' && (
              <View style={styles.timeInput}>
                <TextInput
                  style={styles.input}
                  placeholder="Select date and time"
                  value={scheduledTime}
                  onChangeText={setScheduledTime}
                  onFocus={() => Alert.alert('Feature', 'Date/time picker coming soon!')}
                />
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            (!pickupAddress || !dropoffAddress) && styles.disabledButton,
          ]}
          onPress={handleContinue}
          disabled={!pickupAddress || !dropoffAddress}>
          <Text
            style={[
              styles.continueText,
              (!pickupAddress || !dropoffAddress) && styles.disabledText,
            ]}>
            Get Price Estimate
          </Text>
          <ChevronRight
            size={20}
            color={pickupAddress && dropoffAddress ? '#FFFFFF' : '#9CA3AF'}
            strokeWidth={2}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressStep: {
    width: 60,
    height: 4,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
    borderRadius: 2,
  },
  activeStep: {
    backgroundColor: '#5A47FF',
  },
  completedStep: {
    backgroundColor: '#10B981',
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 12,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  addressInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    minHeight: 56,
    paddingRight: 56,
  },
  searchButton: {
    position: 'absolute',
    right: 16,
    top: 18,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  savedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  savedAddressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#6B7280',
  },
  timeOptions: {
    gap: 12,
  },
  timeOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  selectedTimeOption: {
    borderColor: '#5A47FF',
    backgroundColor: '#F8F9FF',
  },
  timeOptionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  selectedTimeText: {
    color: '#5A47FF',
  },
  timeOptionSubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  timeInput: {
    marginTop: 16,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  bottomContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  continueButton: {
    flexDirection: 'row',
    backgroundColor: '#5A47FF',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#E5E7EB',
  },
  continueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
  disabledText: {
    color: '#9CA3AF',
  },
});
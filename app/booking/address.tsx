import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import {
  ArrowLeft,
  MapPin,
  Home,
  Building,
  Clock,
  ChevronRight,
  Search,
  X,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAddressAutocomplete, AddressSuggestion } from '@/hooks/useAddressAutocomplete';

interface Address {
  id: string;
  label: string;
  address: string;
  icon: any;
}

interface AddressWithCoords {
  address: string;
  latitude: number;
  longitude: number;
}

export default function AddressScreen() {
  const { size } = useLocalSearchParams<{ size: string }>();
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [deliveryTime, setDeliveryTime] = useState<'now' | 'scheduled'>('now');
  const [scheduledTime, setScheduledTime] = useState('');
  
  // Address autocomplete for pickup
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [pickupInputFocused, setPickupInputFocused] = useState(false);
  const pickupInputRef = useRef<TextInput>(null);
  const {
    suggestions: pickupSuggestions,
    loading: pickupLoading,
    searchAddresses: searchPickupAddresses,
    clearSuggestions: clearPickupSuggestions,
  } = useAddressAutocomplete();

  // Address autocomplete for dropoff
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);
  const [dropoffInputFocused, setDropoffInputFocused] = useState(false);
  const dropoffInputRef = useRef<TextInput>(null);
  const {
    suggestions: dropoffSuggestions,
    loading: dropoffLoading,
    searchAddresses: searchDropoffAddresses,
    clearSuggestions: clearDropoffSuggestions,
  } = useAddressAutocomplete();

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

  const handlePickupAddressChange = (text: string) => {
    setPickupAddress(text);
    if (text.length >= 3) {
      searchPickupAddresses(text);
      setShowPickupSuggestions(true);
    } else {
      setShowPickupSuggestions(false);
      clearPickupSuggestions();
    }
  };

  const handleDropoffAddressChange = (text: string) => {
    setDropoffAddress(text);
    if (text.length >= 3) {
      searchDropoffAddresses(text);
      setShowDropoffSuggestions(true);
    } else {
      setShowDropoffSuggestions(false);
      clearDropoffSuggestions();
    }
  };

  const selectPickupSuggestion = (suggestion: AddressSuggestion) => {
    // Use formatted display name which includes house number if available
    const addressText = suggestion.display_name;
    setPickupAddress(addressText);
    setPickupCoords({
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
    });
    // Hide suggestions immediately
    setShowPickupSuggestions(false);
    clearPickupSuggestions();
    // Blur the input
    pickupInputRef.current?.blur();
  };

  const selectDropoffSuggestion = (suggestion: AddressSuggestion) => {
    // Use formatted display name which includes house number if available
    const addressText = suggestion.display_name;
    setDropoffAddress(addressText);
    setDropoffCoords({
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
    });
    // Hide suggestions immediately
    setShowDropoffSuggestions(false);
    clearDropoffSuggestions();
    // Blur the input
    dropoffInputRef.current?.blur();
  };

  const handleContinue = () => {
    if (!pickupAddress || !dropoffAddress) {
      Alert.alert('Missing Information', 'Please enter both pickup and dropoff addresses');
      return;
    }

    if (!pickupCoords || !dropoffCoords) {
      Alert.alert(
        'Address Validation',
        'Please select addresses from the suggestions to ensure accurate delivery location.'
      );
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
        pickupLat: pickupCoords.latitude.toString(),
        pickupLon: pickupCoords.longitude.toString(),
        dropoffLat: dropoffCoords.latitude.toString(),
        dropoffLon: dropoffCoords.longitude.toString(),
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

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!(showPickupSuggestions || showDropoffSuggestions)}
        nestedScrollEnabled={true}>
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
                ref={pickupInputRef}
                style={styles.addressInput}
                placeholder="Enter pickup address"
                value={pickupAddress}
                onChangeText={handlePickupAddressChange}
                onFocus={() => {
                  setPickupInputFocused(true);
                  if (pickupAddress.length >= 3) {
                    setShowPickupSuggestions(true);
                  }
                }}
                onBlur={(e) => {
                  // Don't hide suggestions if user is clicking on them
                  const target = e.target;
                  setTimeout(() => {
                    // Only hide if suggestions are still showing and input is not focused
                    if (showPickupSuggestions && !pickupInputFocused) {
                      setShowPickupSuggestions(false);
                    }
                    setPickupInputFocused(false);
                  }, 200);
                }}
                multiline={false}
                editable={true}
              />
              {pickupAddress.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => {
                    setPickupAddress('');
                    setPickupCoords(null);
                    clearPickupSuggestions();
                    setShowPickupSuggestions(false);
                  }}>
                  <X size={18} color="#6B7280" strokeWidth={2} />
                </TouchableOpacity>
              )}
              {pickupLoading && (
                <View style={styles.loadingIndicator}>
                  <ActivityIndicator size="small" color="#5A47FF" />
                </View>
              )}
            </View>

            {/* Pickup Address Suggestions */}
            {showPickupSuggestions && pickupSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {pickupSuggestions.map((item) => (
                  <TouchableOpacity
                    key={item.place_id.toString()}
                    style={styles.suggestionItem}
                    activeOpacity={0.6}
                    onPress={() => {
                      // Set the address immediately
                      const addressText = item.display_name;
                      setPickupAddress(addressText);
                      setPickupCoords({
                        latitude: parseFloat(item.lat),
                        longitude: parseFloat(item.lon),
                      });
                      // Hide suggestions immediately
                      setShowPickupSuggestions(false);
                      clearPickupSuggestions();
                      // Blur after ensuring value is set
                      setTimeout(() => {
                        pickupInputRef.current?.blur();
                      }, 100);
                    }}>
                    <MapPin size={16} color="#5A47FF" strokeWidth={2} />
                    <Text style={styles.suggestionText} numberOfLines={2}>
                      {item.display_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

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
                ref={dropoffInputRef}
                style={styles.addressInput}
                placeholder="Enter dropoff address"
                value={dropoffAddress}
                onChangeText={handleDropoffAddressChange}
                onFocus={() => {
                  setDropoffInputFocused(true);
                  if (dropoffAddress.length >= 3) {
                    setShowDropoffSuggestions(true);
                  }
                }}
                onBlur={(e) => {
                  // Don't hide suggestions if user is clicking on them
                  const target = e.target;
                  setTimeout(() => {
                    // Only hide if suggestions are still showing and input is not focused
                    if (showDropoffSuggestions && !dropoffInputFocused) {
                      setShowDropoffSuggestions(false);
                    }
                    setDropoffInputFocused(false);
                  }, 200);
                }}
                multiline={false}
                editable={true}
              />
              {dropoffAddress.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => {
                    setDropoffAddress('');
                    setDropoffCoords(null);
                    clearDropoffSuggestions();
                    setShowDropoffSuggestions(false);
                  }}>
                  <X size={18} color="#6B7280" strokeWidth={2} />
                </TouchableOpacity>
              )}
              {dropoffLoading && (
                <View style={styles.loadingIndicator}>
                  <ActivityIndicator size="small" color="#5A47FF" />
                </View>
              )}
            </View>

            {/* Dropoff Address Suggestions */}
            {showDropoffSuggestions && dropoffSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {dropoffSuggestions.map((item) => (
                  <TouchableOpacity
                    key={item.place_id.toString()}
                    style={styles.suggestionItem}
                    activeOpacity={0.6}
                    onPress={() => {
                      // Set the address immediately
                      const addressText = item.display_name;
                      setDropoffAddress(addressText);
                      setDropoffCoords({
                        latitude: parseFloat(item.lat),
                        longitude: parseFloat(item.lon),
                      });
                      // Hide suggestions immediately
                      setShowDropoffSuggestions(false);
                      clearDropoffSuggestions();
                      // Blur after ensuring value is set
                      setTimeout(() => {
                        dropoffInputRef.current?.blur();
                      }, 100);
                    }}>
                    <MapPin size={16} color="#EF4444" strokeWidth={2} />
                    <Text style={styles.suggestionText} numberOfLines={2}>
                      {item.display_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

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
            (!pickupAddress || !dropoffAddress || !pickupCoords || !dropoffCoords) && styles.disabledButton,
          ]}
          onPress={handleContinue}
          disabled={!pickupAddress || !dropoffAddress || !pickupCoords || !dropoffCoords}>
          <Text
            style={[
              styles.continueText,
              (!pickupAddress || !dropoffAddress || !pickupCoords || !dropoffCoords) && styles.disabledText,
            ]}>
            Get Price Estimate
          </Text>
          <ChevronRight
            size={20}
            color={pickupAddress && dropoffAddress && pickupCoords && dropoffCoords ? '#FFFFFF' : '#9CA3AF'}
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
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 200,
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
    zIndex: 1000,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    minHeight: 50,
    backgroundColor: 'transparent',
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    marginLeft: 12,
  },
  clearButton: {
    position: 'absolute',
    right: 16,
    top: 18,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIndicator: {
    position: 'absolute',
    right: 50,
    top: 18,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  MapPin,
  Home,
  Building,
  Clock,
  ChevronRight,
  Search,
  X,
  Navigation,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import { useAddressAutocomplete, AddressSuggestion } from '@/hooks/useAddressAutocomplete';
import { useSavedAddresses } from '@/hooks/useSavedAddresses';
import { reverseGeocodeCoords } from '@/lib/googleDirections';

interface Address {
  id: string;
  label: string;
  address: string;
  icon: any;
  latitude?: number;
  longitude?: number;
}

function getIconForLabel(label: string) {
  const lower = label.toLowerCase();
  if (lower === 'home') return Home;
  if (lower === 'work' || lower === 'office') return Building;
  return MapPin;
}

/** Default scheduled time: tomorrow 9:00 AM, or today 9:00 AM if it's still before 9. */
function getDefaultScheduledDate(): Date {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const today9 = new Date(now);
  today9.setHours(9, 0, 0, 0);
  if (today9 > now) return today9;
  return tomorrow;
}

function formatScheduledDisplay(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Next 14 days for the schedule picker. */
function getDateOptions(): { label: string; date: Date }[] {
  const out: { label: string; date: Date }[] = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    out.push({ label, date: d });
  }
  return out;
}

/** 30-min time slots from 6:00 to 20:00; if forDate is today, only future slots. */
function getTimeSlots(forDate: Date): { label: string; hours: number; minutes: number }[] {
  const slots: { label: string; hours: number; minutes: number }[] = [];
  const now = new Date();
  const isToday = forDate.getDate() === now.getDate() && forDate.getMonth() === now.getMonth() && forDate.getFullYear() === now.getFullYear();
  for (let h = 6; h <= 20; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === 20 && m > 0) break;
      if (isToday) {
        const slot = new Date(forDate);
        slot.setHours(h, m, 0, 0);
        if (slot <= now) continue;
      }
      const label = `${h <= 12 ? h : h - 12}:${m === 0 ? '00' : '30'} ${h < 12 ? 'AM' : 'PM'}`;
      slots.push({ label, hours: h, minutes: m });
    }
  }
  return slots;
}

interface AddressWithCoords {
  address: string;
  latitude: number;
  longitude: number;
}

export default function AddressScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { showAlert } = useAlert();
  const { size, scheduleLater, rebookPickup, rebookDropoff, pickupLat, pickupLon, dropoffLat, dropoffLon } =
    useLocalSearchParams<{
      size: string;
      scheduleLater?: string;
      rebookPickup?: string;
      rebookDropoff?: string;
      pickupLat?: string;
      pickupLon?: string;
      dropoffLat?: string;
      dropoffLon?: string;
    }>();
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [deliveryTime, setDeliveryTime] = useState<'now' | 'scheduled'>(scheduleLater ? 'scheduled' : 'now');
  const [scheduledTime, setScheduledTime] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(() => getDefaultScheduledDate());
  const [modalSelectedDate, setModalSelectedDate] = useState<Date>(() => getDefaultScheduledDate());
  const [modalSelectedTime, setModalSelectedTime] = useState({ hours: 9, minutes: 0 });
  const [locationLoading, setLocationLoading] = useState(false);
  
  // Address autocomplete for pickup
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [pickupInputFocused, setPickupInputFocused] = useState(false);
  const pickupInputRef = useRef<TextInput>(null);
  const {
    suggestions: pickupSuggestions,
    loading: pickupLoading,
    searchAddresses: searchPickupAddresses,
    clearSuggestions: clearPickupSuggestions,
    getPlaceDetails: getPickupPlaceDetails,
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
    getPlaceDetails: getDropoffPlaceDetails,
  } = useAddressAutocomplete();

  const { addresses: savedAddressesFromDb } = useSavedAddresses();

  useEffect(() => {
    if (rebookPickup) setPickupAddress(rebookPickup);
    if (rebookDropoff) setDropoffAddress(rebookDropoff);
    if (pickupLat && pickupLon) {
      setPickupCoords({
        latitude: parseFloat(pickupLat),
        longitude: parseFloat(pickupLon),
      });
    }
    if (dropoffLat && dropoffLon) {
      setDropoffCoords({
        latitude: parseFloat(dropoffLat),
        longitude: parseFloat(dropoffLon),
      });
    }
  }, [rebookPickup, rebookDropoff, pickupLat, pickupLon, dropoffLat, dropoffLon]);

  const savedAddresses: Address[] = savedAddressesFromDb.map((a) => ({
    id: a.id,
    label: a.label,
    address: a.address,
    icon: getIconForLabel(a.label),
    latitude: a.latitude,
    longitude: a.longitude,
  }));

  const handlePickupAddressChange = (text: string) => {
    setPickupAddress(text);
    if (text.trim().length >= 2) {
      searchPickupAddresses(text);
      setShowPickupSuggestions(true);
    } else {
      setShowPickupSuggestions(false);
      clearPickupSuggestions();
    }
  };

  const handleDropoffAddressChange = (text: string) => {
    setDropoffAddress(text);
    if (text.trim().length >= 2) {
      searchDropoffAddresses(text);
      setShowDropoffSuggestions(true);
    } else {
      setShowDropoffSuggestions(false);
      clearDropoffSuggestions();
    }
  };

  const handleUseMyLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert(
          'Location Permission',
          'Please enable location access to use your current location as the pickup address.'
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      let address = await reverseGeocodeCoords(latitude, longitude);
      if (!address) {
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (results.length > 0) {
          const r = results[0];
          address = [r.name, r.street, r.city, r.region].filter(Boolean).join(', ');
        }
      }

      if (!address) {
        showAlert(
          'Location Error',
          'Could not determine your address. Please enter the pickup address manually.'
        );
        return;
      }

      setPickupAddress(address);
      setPickupCoords({ latitude, longitude });
      setShowPickupSuggestions(false);
      clearPickupSuggestions();
      pickupInputRef.current?.blur();
    } catch (e) {
      console.warn('Failed to get location:', e);
      showAlert(
        'Location Error',
        'Unable to get your current location. Please try again or enter an address manually.'
      );
    } finally {
      setLocationLoading(false);
    }
  };

  const selectPickupSuggestion = async (suggestion: AddressSuggestion) => {
    let resolved = suggestion;
    if (typeof suggestion.place_id === 'string' && (!suggestion.lat || !suggestion.lon)) {
      const details = await getPickupPlaceDetails(suggestion.place_id);
      if (!details) return;
      resolved = details;
    }
    setPickupAddress(resolved.display_name);
    setPickupCoords({
      latitude: parseFloat(resolved.lat),
      longitude: parseFloat(resolved.lon),
    });
    setShowPickupSuggestions(false);
    clearPickupSuggestions();
    pickupInputRef.current?.blur();
  };

  const selectDropoffSuggestion = async (suggestion: AddressSuggestion) => {
    let resolved = suggestion;
    if (typeof suggestion.place_id === 'string' && (!suggestion.lat || !suggestion.lon)) {
      const details = await getDropoffPlaceDetails(suggestion.place_id);
      if (!details) return;
      resolved = details;
    }
    setDropoffAddress(resolved.display_name);
    setDropoffCoords({
      latitude: parseFloat(resolved.lat),
      longitude: parseFloat(resolved.lon),
    });
    setShowDropoffSuggestions(false);
    clearDropoffSuggestions();
    dropoffInputRef.current?.blur();
  };

  const handleContinue = () => {
    if (!pickupAddress || !dropoffAddress) {
      showAlert('Missing Information', 'Please enter both pickup and dropoff addresses');
      return;
    }

    if (!pickupCoords || !dropoffCoords) {
      showAlert(
        'Address Validation',
        'Please select addresses from the suggestions to ensure accurate delivery location.'
      );
      return;
    }

    if (deliveryTime === 'scheduled' && !scheduledTime) {
      showAlert('Missing Information', 'Please select a scheduled delivery time');
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
      if (address.latitude != null && address.longitude != null) {
        setPickupCoords({ latitude: address.latitude, longitude: address.longitude });
      } else {
        setPickupCoords(null);
      }
    } else {
      setDropoffAddress(address.address);
      if (address.latitude != null && address.longitude != null) {
        setDropoffCoords({ latitude: address.latitude, longitude: address.longitude });
      } else {
        setDropoffCoords(null);
      }
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border, paddingTop: 16 + insets.top }]}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.colors.surface }]} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Addresses & Time</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled={true}
      >
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressStep, { backgroundColor: theme.colors.success }]} />
            <View style={[styles.progressStep, { backgroundColor: theme.colors.primary }]} />
            <View style={[styles.progressStep, { backgroundColor: theme.colors.border }]} />
            <View style={[styles.progressStep, { backgroundColor: theme.colors.border }]} />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>Step 2 of 4</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Pickup Address */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MapPin size={24} color={theme.colors.success} strokeWidth={2} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Pickup Address</Text>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                ref={pickupInputRef}
                style={[styles.addressInput, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Enter pickup address"
                placeholderTextColor={theme.colors.textSecondary}
                value={pickupAddress}
                onChangeText={handlePickupAddressChange}
                onFocus={() => {
                  setPickupInputFocused(true);
                  if (pickupAddress.trim().length >= 2) {
                    setShowPickupSuggestions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    if (showPickupSuggestions && !pickupInputFocused) setShowPickupSuggestions(false);
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
                  <X size={18} color={theme.colors.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
              )}
              {pickupLoading && (
                <View style={styles.loadingIndicator}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.useLocationButton,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                locationLoading && styles.useLocationButtonDisabled,
              ]}
              onPress={handleUseMyLocation}
              disabled={locationLoading}
              activeOpacity={0.7}>
              {locationLoading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Navigation size={18} color={theme.colors.primary} strokeWidth={2} />
              )}
              <Text style={[styles.useLocationText, { color: theme.colors.primary }]}>
                {locationLoading ? 'Getting your location...' : 'Use my location'}
              </Text>
            </TouchableOpacity>

            {/* Pickup Address Suggestions */}
            {showPickupSuggestions && pickupSuggestions.length > 0 && (
              <View style={[styles.suggestionsContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <ScrollView
                  style={styles.suggestionsScroll}
                  contentContainerStyle={styles.suggestionsScrollContent}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}>
                  {pickupSuggestions.map((item) => (
                    <TouchableOpacity
                      key={item.place_id.toString()}
                      style={[styles.suggestionItem, { borderBottomColor: theme.colors.border }]}
                      activeOpacity={0.6}
                      onPress={() => selectPickupSuggestion(item)}>
                      <MapPin size={16} color={theme.colors.primary} strokeWidth={2} />
                      <Text style={[styles.suggestionText, { color: theme.colors.text }]} numberOfLines={2}>
                        {item.display_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Saved Addresses (user-defined from Profile) */}
            {savedAddresses.length > 0 && (
              <>
                <Text style={[styles.savedTitle, { color: theme.colors.textSecondary }]}>Saved Addresses</Text>
                {savedAddresses.map((address) => (
                  <TouchableOpacity
                    key={address.id}
                    style={[styles.savedAddressCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    onPress={() => selectAddress(address, 'pickup')}>
                    <View style={[styles.addressIcon, { backgroundColor: theme.colors.surface }]}>
                      <address.icon size={20} color={theme.colors.primary} strokeWidth={2} />
                    </View>
                    <View style={styles.addressInfo}>
                      <Text style={[styles.addressLabel, { color: theme.colors.text }]}>{address.label}</Text>
                      <Text style={[styles.addressText, { color: theme.colors.textSecondary }]}>{address.address}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>

          {/* Dropoff Address */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MapPin size={24} color={theme.colors.error} strokeWidth={2} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Dropoff Address</Text>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                ref={dropoffInputRef}
                style={[styles.addressInput, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Enter dropoff address"
                placeholderTextColor={theme.colors.textSecondary}
                value={dropoffAddress}
                onChangeText={handleDropoffAddressChange}
                onFocus={() => {
                  setDropoffInputFocused(true);
                  if (dropoffAddress.trim().length >= 2) {
                    setShowDropoffSuggestions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    if (showDropoffSuggestions && !dropoffInputFocused) setShowDropoffSuggestions(false);
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
                  <X size={18} color={theme.colors.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
              )}
              {dropoffLoading && (
                <View style={styles.loadingIndicator}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              )}
            </View>

            {/* Dropoff Address Suggestions */}
            {showDropoffSuggestions && dropoffSuggestions.length > 0 && (
              <View style={[styles.suggestionsContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <ScrollView
                  style={styles.suggestionsScroll}
                  contentContainerStyle={styles.suggestionsScrollContent}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}>
                  {dropoffSuggestions.map((item) => (
                    <TouchableOpacity
                      key={item.place_id.toString()}
                      style={[styles.suggestionItem, { borderBottomColor: theme.colors.border }]}
                      activeOpacity={0.6}
                      onPress={() => selectDropoffSuggestion(item)}>
                      <MapPin size={16} color={theme.colors.error} strokeWidth={2} />
                      <Text style={[styles.suggestionText, { color: theme.colors.text }]} numberOfLines={2}>
                        {item.display_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Saved Addresses (user-defined from Profile) */}
            {savedAddresses.length > 0 && (
              <>
                <Text style={[styles.savedTitle, { color: theme.colors.textSecondary }]}>Saved Addresses</Text>
                {savedAddresses.map((address) => (
                  <TouchableOpacity
                    key={address.id}
                    style={[styles.savedAddressCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    onPress={() => selectAddress(address, 'dropoff')}>
                    <View style={[styles.addressIcon, { backgroundColor: theme.colors.surface }]}>
                      <address.icon size={20} color={theme.colors.primary} strokeWidth={2} />
                    </View>
                    <View style={styles.addressInfo}>
                      <Text style={[styles.addressLabel, { color: theme.colors.text }]}>{address.label}</Text>
                      <Text style={[styles.addressText, { color: theme.colors.textSecondary }]}>{address.address}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>

          {/* Delivery Time */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Clock size={24} color={theme.colors.warning} strokeWidth={2} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Delivery Time</Text>
            </View>

            <View style={styles.timeOptions}>
              <TouchableOpacity
                style={[
                  styles.timeOption,
                  { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                  deliveryTime === 'now' && { borderColor: theme.colors.primary, backgroundColor: theme.colors.surface },
                ]}
                onPress={() => setDeliveryTime('now')}>
                <Text style={[styles.timeOptionText, { color: theme.colors.text }, deliveryTime === 'now' && { color: theme.colors.primary }]}>Deliver Now</Text>
                <Text style={[styles.timeOptionSubtext, { color: theme.colors.textSecondary }, deliveryTime === 'now' && { color: theme.colors.primary }]}>Pickup within 15-30 mins</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.timeOption,
                  { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                  deliveryTime === 'scheduled' && { borderColor: theme.colors.primary, backgroundColor: theme.colors.surface },
                ]}
                onPress={() => setDeliveryTime('scheduled')}>
                <Text style={[styles.timeOptionText, { color: theme.colors.text }, deliveryTime === 'scheduled' && { color: theme.colors.primary }]}>Schedule for Later</Text>
                <Text style={[styles.timeOptionSubtext, { color: theme.colors.textSecondary }, deliveryTime === 'scheduled' && { color: theme.colors.primary }]}>Choose pickup time</Text>
              </TouchableOpacity>
            </View>

            {deliveryTime === 'scheduled' && (
              <View style={styles.timeInput}>
                <TouchableOpacity
                  style={[styles.input, styles.scheduleTouchable, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                  onPress={() => {
                    const base = scheduledTime ? new Date(scheduledTime) : getDefaultScheduledDate();
                    setPickerDate(base);
                    let day = new Date(base.getFullYear(), base.getMonth(), base.getDate());
                    let time = { hours: base.getHours(), minutes: base.getMinutes() };
                    const slots = getTimeSlots(day);
                    if (slots.length === 0) {
                      const tomorrow = new Date(day);
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      day = tomorrow;
                      time = { hours: 9, minutes: 0 };
                    }
                    setModalSelectedDate(day);
                    setModalSelectedTime(time);
                    setShowDatePicker(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.scheduleTouchableText, { color: scheduledTime ? theme.colors.text : theme.colors.textSecondary }]}>
                    {scheduledTime ? formatScheduledDisplay(scheduledTime) : 'Select date and time'}
                  </Text>
                  <Clock size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            )}

            {/* Date/time picker modal (JS-only, works in Expo Go) */}
            <Modal visible={showDatePicker} transparent animationType="slide">
              <Pressable style={styles.datePickerOverlay} onPress={() => setShowDatePicker(false)}>
                <View style={[styles.datePickerModal, { backgroundColor: theme.colors.card }]} onStartShouldSetResponder={() => true}>
                  <View style={[styles.datePickerHeader, { borderBottomColor: theme.colors.border }]}>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                      <Text style={[styles.datePickerCancel, { color: theme.colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={[styles.datePickerTitle, { color: theme.colors.text }]}>Pickup date & time</Text>
                    <TouchableOpacity
                      onPress={() => {
                        const d = new Date(modalSelectedDate.getFullYear(), modalSelectedDate.getMonth(), modalSelectedDate.getDate(), modalSelectedTime.hours, modalSelectedTime.minutes, 0, 0);
                        setPickerDate(d);
                        setScheduledTime(d.toISOString());
                        setShowDatePicker(false);
                      }}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Text style={[styles.datePickerConfirm, { color: theme.colors.primary }]}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.datePickerScroll} showsVerticalScrollIndicator={false}>
                    <Text style={[styles.datePickerSectionLabel, { color: theme.colors.textSecondary }]}>Date</Text>
                    <View style={styles.datePickerChips}>
                      {getDateOptions().map((opt) => {
                        const isSelected = modalSelectedDate.getDate() === opt.date.getDate() && modalSelectedDate.getMonth() === opt.date.getMonth() && modalSelectedDate.getFullYear() === opt.date.getFullYear();
                        return (
                          <TouchableOpacity
                            key={opt.date.toISOString()}
                            style={[styles.datePickerChip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, isSelected && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '20' }]}
                            onPress={() => setModalSelectedDate(opt.date)}
                          >
                            <Text style={[styles.datePickerChipText, { color: theme.colors.text }, isSelected && { color: theme.colors.primary, fontWeight: '600' }]}>{opt.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={[styles.datePickerSectionLabel, { color: theme.colors.textSecondary, marginTop: 16 }]}>Time</Text>
                    <View style={styles.datePickerChips}>
                      {getTimeSlots(modalSelectedDate).map((slot) => {
                        const isSelected = modalSelectedTime.hours === slot.hours && modalSelectedTime.minutes === slot.minutes;
                        return (
                          <TouchableOpacity
                            key={`${slot.hours}-${slot.minutes}`}
                            style={[styles.datePickerChip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, isSelected && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '20' }]}
                            onPress={() => setModalSelectedTime({ hours: slot.hours, minutes: slot.minutes })}
                          >
                            <Text style={[styles.datePickerChipText, { color: theme.colors.text }, isSelected && { color: theme.colors.primary, fontWeight: '600' }]}>{slot.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              </Pressable>
            </Modal>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View style={[styles.bottomContainer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            (pickupAddress && dropoffAddress && pickupCoords && dropoffCoords && (deliveryTime !== 'scheduled' || !!scheduledTime)) ? { backgroundColor: theme.colors.primary } : { backgroundColor: theme.colors.border },
          ]}
          onPress={handleContinue}
          disabled={!pickupAddress || !dropoffAddress || !pickupCoords || !dropoffCoords || (deliveryTime === 'scheduled' && !scheduledTime)}>
          <Text
            style={[
              styles.continueText,
              (pickupAddress && dropoffAddress && pickupCoords && dropoffCoords && (deliveryTime !== 'scheduled' || !!scheduledTime)) ? { color: '#FFFFFF' } : { color: theme.colors.textTertiary },
            ]}>
            Get Price Estimate
          </Text>
          <ChevronRight
            size={20}
            color={pickupAddress && dropoffAddress && pickupCoords && dropoffCoords && (deliveryTime !== 'scheduled' || !!scheduledTime) ? '#FFFFFF' : theme.colors.textTertiary}
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
    marginBottom: 8,
  },
  useLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  useLocationButtonDisabled: {
    opacity: 0.7,
  },
  useLocationText: {
    fontSize: 14,
    fontWeight: '600',
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
  scheduleTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scheduleTouchableText: {
    fontSize: 16,
    flex: 1,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  datePickerModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  datePickerCancel: {
    fontSize: 16,
  },
  datePickerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  datePickerConfirm: {
    fontSize: 16,
    fontWeight: '600',
  },
  datePickerScroll: {
    maxHeight: 320,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  datePickerSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  datePickerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  datePickerChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 2,
  },
  datePickerChipText: {
    fontSize: 14,
  },
  bottomContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  continueButton: {
    flexDirection: 'row',
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
    maxHeight: 220,
    marginTop: 8,
    marginBottom: 16,
    overflow: 'hidden',
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
  suggestionsScroll: {
    maxHeight: 220,
  },
  suggestionsScrollContent: {
    paddingBottom: 8,
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
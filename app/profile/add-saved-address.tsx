import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, MapPin } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import { useSavedAddresses } from '@/hooks/useSavedAddresses';
import { useAddressAutocomplete, type AddressSuggestion } from '@/hooks/useAddressAutocomplete';
import { FormError } from '@/components/FormError';

export default function AddSavedAddressScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { showToast } = useAlert();
  const { add } = useSavedAddresses();
  const [label, setLabel] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    suggestions,
    loading: searchLoading,
    searchAddresses,
    clearSuggestions,
    getPlaceDetails,
  } = useAddressAutocomplete();

  const handleAddressChange = (text: string) => {
    setAddressInput(text);
    if (text.trim().length >= 2) {
      searchAddresses(text);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      clearSuggestions();
    }
  };

  const handleSelectSuggestion = async (suggestion: AddressSuggestion) => {
    let resolved = suggestion;
    if (typeof suggestion.place_id === 'string' && (!suggestion.lat || !suggestion.lon)) {
      const details = await getPlaceDetails(suggestion.place_id);
      if (!details) {
        setFormError('Could not get address details. Please try again.');
        return;
      }
      resolved = details;
    }
    setAddressInput(resolved.display_name);
    setShowSuggestions(false);
    clearSuggestions();

    const labelTrim = label.trim() || 'Address';
    const lat = parseFloat(resolved.lat);
    const lon = parseFloat(resolved.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      setFormError('This address has no coordinates. Please choose a full address from the list.');
      return;
    }

    setSaving(true);
    try {
      await add({
        label: labelTrim,
        address: resolved.display_name,
        latitude: lat,
        longitude: lon,
      });
      showToast('Address saved.');
      router.back();
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : 'Could not save. Make sure the saved_addresses table exists (run the migration).'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, {
        backgroundColor: theme.colors.card,
        borderBottomColor: theme.colors.border,
        paddingTop: 16 + insets.top,
      }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDark ? theme.colors.surface : '#F3F4F6' }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Add address</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Label (e.g. Home, Work)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
            placeholder="Home"
            placeholderTextColor={theme.colors.textTertiary}
            value={label}
            onChangeText={setLabel}
            autoCapitalize="words"
          />
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Address</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text, paddingLeft: 44 }]}
              placeholder="Search for an address"
              placeholderTextColor={theme.colors.textTertiary}
              value={addressInput}
              onChangeText={handleAddressChange}
              onFocus={() => addressInput.length >= 3 && setShowSuggestions(true)}
            />
            <View style={styles.inputIcon}>
              <MapPin size={20} color={theme.colors.textTertiary} strokeWidth={2} />
            </View>
          </View>
          {searchLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>Searching...</Text>
            </View>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <View style={[styles.suggestionsBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <ScrollView
                style={styles.suggestionsScroll}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.suggestionsScrollContent}>
                {suggestions.map((s) => (
                  <TouchableOpacity
                    key={String(s.place_id)}
                    style={[styles.suggestionRow, { borderBottomColor: theme.colors.border }]}
                    onPress={() => handleSelectSuggestion(s)}
                  >
                    <MapPin size={16} color={theme.colors.primary} strokeWidth={2} />
                    <Text style={[styles.suggestionText, { color: theme.colors.text }]} numberOfLines={2}>
                      {s.display_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <FormError message={formError} />
          <Text style={[styles.hint, { color: theme.colors.textTertiary, marginTop: 8 }]}>
            Type at least 3 characters and select an address from the list to save it with coordinates.
          </Text>
        </View>
        {saving && (
          <View style={styles.savingWrap}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>Saving...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '700' },
  placeholder: { width: 44 },
  scrollView: { flex: 1 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  inputWrap: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  suggestionsBox: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 220,
    overflow: 'hidden',
  },
  suggestionsScroll: { maxHeight: 220 },
  suggestionsScrollContent: { paddingBottom: 8 },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    minHeight: 44,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  suggestionText: { flex: 1, fontSize: 14 },
  hint: { fontSize: 13 },
  savingWrap: { alignItems: 'center', paddingVertical: 24 },
});

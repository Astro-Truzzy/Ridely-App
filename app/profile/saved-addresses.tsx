import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, MapPin, Plus, Trash2 } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import { useSavedAddresses, type SavedAddress } from '@/hooks/useSavedAddresses';

function getLabelIcon(label: string) {
  const lower = label.toLowerCase();
  if (lower === 'home') return '🏠';
  if (lower === 'work' || lower === 'office') return '🏢';
  return '📍';
}

export default function SavedAddressesScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { showAlert } = useAlert();
  const { addresses, loading, error, remove } = useSavedAddresses();

  const handleDelete = (item: SavedAddress) => {
    showAlert(
      'Remove address',
      `Remove "${item.label}" from saved addresses?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => remove(item.id) },
      ]
    );
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
        <Text style={[styles.title, { color: theme.colors.text }]}>Saved Addresses</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: isDark ? theme.colors.surface : '#F0F2FF' }]}
          onPress={() => router.push('/profile/add-saved-address')}
        >
          <Plus size={20} color={theme.colors.primary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={styles.section}>
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading addresses...</Text>
          </View>
        ) : addresses.length === 0 ? (
          <View style={styles.emptyWrap}>
            <MapPin size={48} color={theme.colors.textTertiary} strokeWidth={2} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No saved addresses</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              Add home, work, or other locations to use them when booking.
            </Text>
            <TouchableOpacity
              style={[styles.addFirstButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => router.push('/profile/add-saved-address')}
            >
              <Plus size={20} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.addFirstButtonText}>Add address</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            {addresses.map((item) => (
              <View
                key={item.id}
                style={[styles.card, {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                }]}
              >
                <View style={styles.cardContent}>
                  <Text style={styles.labelIcon}>{getLabelIcon(item.label)}</Text>
                  <View style={styles.cardText}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>{item.label}</Text>
                    <Text style={[styles.address, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                      {item.address}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.deleteBtn, { backgroundColor: isDark ? theme.colors.card : '#FEE2E2' }]}
                  onPress={() => handleDelete(item)}
                >
                  <Trash2 size={18} color={theme.colors.error} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.addCard, { borderColor: theme.colors.border }]}
              onPress={() => router.push('/profile/add-saved-address')}
            >
              <Plus size={24} color={theme.colors.primary} strokeWidth={2} />
              <Text style={[styles.addCardText, { color: theme.colors.primary }]}>Add new address</Text>
            </TouchableOpacity>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '700' },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: { flex: 1 },
  section: { padding: 20 },
  errorText: { fontSize: 14, paddingVertical: 12 },
  loadingWrap: { alignItems: 'center', paddingVertical: 48 },
  loadingText: { fontSize: 14, marginTop: 12 },
  emptyWrap: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  addFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 8,
  },
  addFirstButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  labelIcon: { fontSize: 24, marginRight: 12 },
  cardText: { flex: 1, minWidth: 0 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  address: { fontSize: 14 },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginTop: 8,
    gap: 8,
  },
  addCardText: { fontSize: 16, fontWeight: '600' },
});

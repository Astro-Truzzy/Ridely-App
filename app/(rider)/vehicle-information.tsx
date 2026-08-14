import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Car, FileText, Save } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';

export default function VehicleInformationScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { userProfile, updateProfile } = useAuth();
  const { showAlert } = useAlert();
  const [profile, setProfile] = useState({
    vehicleType: (userProfile as { vehicle_type?: string } | null)?.vehicle_type ?? '',
    plateNumber: (userProfile as { plate_number?: string } | null)?.plate_number ?? '',
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (userProfile) {
      const p = userProfile as { vehicle_type?: string; plate_number?: string };
      setProfile({
        vehicleType: p.vehicle_type ?? '',
        plateNumber: p.plate_number ?? '',
      });
    }
  }, [userProfile]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await updateProfile({
        vehicle_type: profile.vehicleType.trim() || undefined,
        plate_number: profile.plateNumber.trim() || undefined,
      });
      showAlert('Success', 'Vehicle information updated successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: unknown) {
      console.error('Vehicle update error:', error);
      showAlert(
        'Error',
        error instanceof Error ? error.message : 'Failed to update vehicle information.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      width: 44,
    height: 44,
    borderRadius: 22,
      backgroundColor: theme.colors.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
    saveButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    saveButtonDisabled: { backgroundColor: theme.colors.card, opacity: 0.6 },
    keyboardAvoidingView: { flex: 1 },
    scrollView: { flex: 1 },
    section: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: 20,
      borderRadius: 16,
      padding: 20,
      marginTop: 24,
      marginBottom: 24,
      ...theme.shadows.medium,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 20,
    },
    inputGroup: { marginBottom: 20 },
    inputGroupLast: { marginBottom: 0 },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
      marginLeft: 12,
    },
    bottomContainer: {
      padding: 20,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    saveButtonLarge: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
    },
    saveButtonText: { fontSize: 16, fontWeight: '600', color: theme.colors.surface },
  });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.title}>Vehicle Information</Text>
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <Save size={20} color={theme.colors.primary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle Details</Text>
            <Text style={styles.sectionSubtitle}>
              Keep your vehicle details up to date for deliveries.
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Vehicle Type</Text>
              <View style={[styles.inputContainer, { borderColor: theme.colors.border }]}>
                <Car size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  value={profile.vehicleType}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, vehicleType: text }))}
                  placeholder="e.g. Motorcycle, Bike, Car"
                  placeholderTextColor={theme.colors.textTertiary}
                />
              </View>
            </View>
            <View style={[styles.inputGroup, styles.inputGroupLast]}>
              <Text style={styles.inputLabel}>Plate Number</Text>
              <View style={[styles.inputContainer, { borderColor: theme.colors.border }]}>
                <FileText size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  value={profile.plateNumber}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, plateNumber: text }))}
                  placeholder="License plate number"
                  placeholderTextColor={theme.colors.textTertiary}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomContainer, { borderTopColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[styles.saveButtonLarge, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={[styles.saveButtonText, { color: theme.colors.surface }]}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

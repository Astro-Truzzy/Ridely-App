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
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Camera,
  Save,
  Car,
  FileText,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { AnimatedPressable } from '@/components/rider/AnimatedPressable';
import { pickProfileImage, uploadAvatar } from '@/lib/avatarUpload';

export default function RiderEditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { userProfile, user, updateProfile } = useAuth();
  const { showAlert } = useAlert();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profile, setProfile] = useState({
    name: (userProfile as { full_name?: string } | null)?.full_name ?? '',
    email: (userProfile as { email?: string } | null)?.email ?? '',
    phone: (userProfile as { phone?: string } | null)?.phone ?? '',
    vehicleType: (userProfile as { vehicle_type?: string } | null)?.vehicle_type ?? '',
    plateNumber: (userProfile as { plate_number?: string } | null)?.plate_number ?? '',
  });
  const [avatar, setAvatar] = useState<string | null>((userProfile as { avatar_url?: string | null } | null)?.avatar_url ?? null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (userProfile) {
      const p = userProfile as { full_name?: string; email?: string; phone?: string; vehicle_type?: string; plate_number?: string; avatar_url?: string | null };
      setProfile({
        name: p.full_name ?? '',
        email: p.email ?? '',
        phone: p.phone ?? '',
        vehicleType: p.vehicle_type ?? '',
        plateNumber: p.plate_number ?? '',
      });
      setAvatar(p.avatar_url ?? null);
    }
  }, [userProfile]);

  const handleSave = async () => {
    if (!profile.name.trim()) {
      showAlert('Error', 'Name is required');
      return;
    }
    if (!profile.email.trim() || !profile.email.includes('@')) {
      showAlert('Error', 'Please enter a valid email address');
      return;
    }
    if (!profile.phone.trim()) {
      showAlert('Error', 'Phone number is required');
      return;
    }

    setIsLoading(true);
    try {
      const updates: Parameters<typeof updateProfile>[0] = {
        full_name: profile.name.trim(),
        email: profile.email.trim(),
        phone: profile.phone.trim(),
        vehicle_type: profile.vehicleType.trim() || undefined,
        plate_number: profile.plateNumber.trim() || undefined,
      };
      if (avatar !== (userProfile as { avatar_url?: string | null } | null)?.avatar_url) {
        updates.avatar_url = avatar;
      }
      await updateProfile(updates);
      showAlert('Success', 'Your profile has been updated successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: unknown) {
      console.error('Profile update error:', error);
      showAlert('Error', error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async () => {
    const choice = await new Promise<'camera' | 'gallery' | 'remove' | null>((resolve) => {
      showAlert('Update Profile Picture', 'Choose an option', [
        { text: 'Camera', onPress: () => resolve('camera') },
        { text: 'Gallery', onPress: () => resolve('gallery') },
        { text: 'Remove Photo', onPress: () => resolve('remove'), style: 'destructive' },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ]);
    });
    if (choice === 'remove') {
      try {
        await updateProfile({ avatar_url: null });
        setAvatar(null);
      } catch (e) {
        showAlert('Error', e instanceof Error ? e.message : 'Could not remove photo.');
      }
      return;
    }
    if (!choice || !user?.id) return;
    setUploadingAvatar(true);
    try {
      const picked = await pickProfileImage(choice);
      if (!picked) return;
      const avatarUrl = await uploadAvatar(user.id, picked);
      await updateProfile({ avatar_url: avatarUrl });
      setAvatar(avatarUrl);
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : 'Could not update profile picture.');
    } finally {
      setUploadingAvatar(false);
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
      width: 40,
      height: 40,
      borderRadius: 20,
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
    avatarSection: { alignItems: 'center', paddingVertical: 32 },
    avatarContainer: { position: 'relative', marginBottom: 12 },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 100,
      height: 100,
      borderRadius: 50,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cameraOverlay: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: theme.colors.surface,
    },
    avatarLabel: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: '500' },
    section: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: 20,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
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
    saveButtonTextDisabled: { color: theme.colors.textTertiary },
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
        <AnimatedPressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </AnimatedPressable>
        <Text style={styles.title}>Edit Profile</Text>
        <AnimatedPressable
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <Save size={20} color={theme.colors.primary} strokeWidth={2} />
        </AnimatedPressable>
      </View>

      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarContainer} onPress={handleImageUpload} disabled={uploadingAvatar}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                  <User size={40} color={theme.colors.surface} strokeWidth={2} />
                </View>
              )}
              {uploadingAvatar ? (
                <View style={[styles.avatarOverlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              ) : (
                <View style={styles.cameraOverlay}>
                  <Camera size={16} color={theme.colors.surface} strokeWidth={2} />
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.avatarLabel}>Tap to change photo</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={[styles.inputContainer, { borderColor: theme.colors.border }]}>
                <User size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  value={profile.name}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, name: text }))}
                  placeholder="Enter your full name"
                  placeholderTextColor={theme.colors.textTertiary}
                />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={[styles.inputContainer, { borderColor: theme.colors.border }]}>
                <Mail size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  value={profile.email}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, email: text }))}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={theme.colors.textTertiary}
                />
              </View>
            </View>
            <View style={[styles.inputGroup, styles.inputGroupLast]}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <View style={[styles.inputContainer, { borderColor: theme.colors.border }]}>
                <Phone size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  value={profile.phone}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, phone: text }))}
                  placeholder="Enter your phone number"
                  keyboardType="phone-pad"
                  placeholderTextColor={theme.colors.textTertiary}
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle Information</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Vehicle Type</Text>
              <View style={[styles.inputContainer, { borderColor: theme.colors.border }]}>
                <Car size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  value={profile.vehicleType}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, vehicleType: text }))}
                  placeholder="e.g. Motorcycle, Bike"
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
        <AnimatedPressable
          style={[styles.saveButtonLarge, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={[styles.saveButtonText, { color: theme.colors.surface }]}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

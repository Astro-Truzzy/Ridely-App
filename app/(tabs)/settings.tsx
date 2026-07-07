import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Bell, Moon, Globe, Zap, CircleHelp as HelpCircle, FileText, Shield, LogOut, ChevronRight, Smartphone, Mail, MessageSquare, Sun, Monitor, FlaskConical } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme, ThemeMode } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { supabase } from '@/lib/supabase';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useLanguage } from '@/contexts/LanguageContext';

const TEST_RIDER_ID = 'a1b2c3d4-e5f6-4789-a012-345678901234';

interface SettingsState {
  pushNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  animations: boolean;
  language: string;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, themeMode, setThemeMode, isDark } = useTheme();
  const { signOut, loading, user } = useAuth();
  const { showAlert } = useAlert();
  const { refetch: refetchDeliveries } = useDeliveries();
  const { languageName } = useLanguage();
  const [seeding, setSeeding] = useState(false);
  const [settings, setSettings] = useState<SettingsState>({
    pushNotifications: true,
    emailNotifications: true,
    smsNotifications: false,
    animations: true,
    language: languageName,
  });

  const toggleSetting = (key: keyof SettingsState) => {
    if (typeof settings[key] === 'boolean') {
      setSettings(prev => ({
        ...prev,
        [key]: !prev[key],
      }));
    }
  };

  const notificationSettings = [
    {
      key: 'pushNotifications' as keyof SettingsState,
      title: 'Push Notifications',
      subtitle: 'Delivery updates and alerts',
      icon: Smartphone,
    },
    {
      key: 'emailNotifications' as keyof SettingsState,
      title: 'Email Notifications',
      subtitle: 'Booking confirmations and receipts',
      icon: Mail,
    },
    {
      key: 'smsNotifications' as keyof SettingsState,
      title: 'SMS Notifications',
      subtitle: 'Critical delivery updates',
      icon: MessageSquare,
    },
  ];

  const appSettings = [
    {
      key: 'animations' as keyof SettingsState,
      title: 'Animations',
      subtitle: 'Enable smooth transitions',
      icon: Zap,
    },
  ];

  const themeOptions: { mode: ThemeMode; title: string; subtitle: string; icon: any }[] = [
    {
      mode: 'light',
      title: 'Light Mode',
      subtitle: 'Always use light theme',
      icon: Sun,
    },
    {
      mode: 'dark',
      title: 'Dark Mode',
      subtitle: 'Always use dark theme',
      icon: Moon,
    },
    {
      mode: 'system',
      title: 'System Default',
      subtitle: 'Follow device settings',
      icon: Monitor,
    },
  ];

  const generalSettings = [
    {
      title: 'Language',
      subtitle: languageName,
      icon: Globe,
      onPress: () => router.push('/language'),
      showArrow: true,
    },
    {
      title: 'Notification Schedule',
      subtitle: 'Set quiet hours',
      icon: Bell,
      onPress: () => router.push('/notification-schedule'),
      showArrow: true,
    },
    {
      title: 'Help & Support',
      subtitle: 'Get help and contact support',
      icon: HelpCircle,
      onPress: () => router.push('/support'),
      showArrow: true,
    },
    {
      title: 'Privacy Policy',
      subtitle: 'Read our privacy policy',
      icon: Shield,
      onPress: () => router.push('/privacy-policy'),
      showArrow: true,
    },
    {
      title: 'Terms of Service',
      subtitle: 'Read our terms and conditions',
      icon: FileText,
      onPress: () => router.push('/terms-of-service'),
      showArrow: true,
    },
  ];

  const handleSeedTestData = async () => {
    if (!user) return;
    showAlert(
      'Seed test data',
      'This will add sample deliveries (pending, in-transit, delivered, cancelled) and 2 notifications for your account. Run the SQL seed in docs first to create the test rider for the tracking map.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed',
          onPress: async () => {
            setSeeding(true);
            try {
              const uid = user.id;
              const rows = [
                { user_id: uid, rider_id: TEST_RIDER_ID, pickup_address: '12 Admiralty Way, Lekki Phase 1, Lagos', dropoff_address: '45 Isaac John St, GRA, Ikeja, Lagos', parcel_size: 'medium', status: 'in_transit', total_cost: 3500, distance: 18.5, estimated_time: '35 mins', delivery_time: 'now' },
                { user_id: uid, rider_id: null, pickup_address: 'Shop 3, Ajah Market, Lagos', dropoff_address: 'Victoria Island, Lagos', parcel_size: 'small', status: 'pending', total_cost: 1200, distance: 8.2, estimated_time: '20 mins', delivery_time: 'now' },
                { user_id: uid, rider_id: TEST_RIDER_ID, pickup_address: '15 Ozumba Mbadiwe Ave, VI, Lagos', dropoff_address: '7 Adeola Odeku St, VI, Lagos', parcel_size: 'small', status: 'delivered', total_cost: 2500, distance: 5.1, estimated_time: '15 mins', delivery_time: 'now', completed_at: new Date().toISOString() },
                { user_id: uid, rider_id: TEST_RIDER_ID, pickup_address: '22 Adeola Hopewell St, VI, Lagos', dropoff_address: 'Lekki-Epe Expressway, Lekki, Lagos', parcel_size: 'large', status: 'delivered', total_cost: 6200, distance: 22, estimated_time: '45 mins', delivery_time: 'now', completed_at: new Date(Date.now() - 86400 * 1000).toISOString() },
                { user_id: uid, rider_id: null, pickup_address: '1 Muri Okunola St, VI, Lagos', dropoff_address: 'Alausa, Ikeja, Lagos', parcel_size: 'medium', status: 'cancelled', total_cost: 2800, distance: 14, estimated_time: '30 mins', delivery_time: 'now' },
              ];
              const { error: delError } = await supabase.from('deliveries').insert(rows as never);
              if (delError) throw delError;
              await supabase.from('notifications').insert([
                { user_id: uid, type: 'delivery_update', title: 'Delivery in progress', message: 'Your package is on the way. Track live on the map.', read: false, actionable: true },
                { user_id: uid, type: 'system', title: 'Welcome to Ridely', message: 'Tap Book Delivery to send your first package.', read: true, actionable: false },
              ] as never);
              await refetchDeliveries();
              showAlert('Done', 'Test data added. Check Home, My Bookings, Tracking, and Notifications.');
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Insert failed. Run the SQL seed first to create the test rider (see docs/TEST_DATA_SEED.md).';
              showAlert('Seed failed', msg);
            } finally {
              setSeeding(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    showAlert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              // Navigation is handled by signOut function in AuthContext
            } catch (error: any) {
              showAlert(
                'Logout Failed',
                error.message || 'An error occurred while logging out. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: 20 + insets.top }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Settings</Text>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notifications</Text>
          <View style={[styles.settingsContainer, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
            {notificationSettings.map((setting, index) => (
              <View key={setting.key} style={styles.settingItem}>
                <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
                  <setting.icon size={20} color={theme.colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{setting.title}</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{setting.subtitle}</Text>
                </View>
                <Switch
                  value={settings[setting.key] as boolean}
                  onValueChange={() => toggleSetting(setting.key)}
                  trackColor={{ false: theme.colors.border, true: `${theme.colors.primary}50` }}
                  thumbColor={settings[setting.key] ? theme.colors.primary : theme.colors.textTertiary}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Theme Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Theme</Text>
          <View style={[styles.settingsContainer, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
            {themeOptions.map((option, index) => (
              <TouchableOpacity
                key={option.mode}
                style={[
                  styles.settingItem,
                  index < themeOptions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }
                ]}
                onPress={() => setThemeMode(option.mode)}>
                <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
                  <option.icon size={20} color={theme.colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{option.title}</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{option.subtitle}</Text>
                </View>
                {themeMode === option.mode && (
                  <View style={[styles.checkmark, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {/* App Settings Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>App Settings</Text>
          <View style={[styles.settingsContainer, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
            {appSettings.map((setting, index) => (
              <View key={setting.key} style={styles.settingItem}>
                <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
                  <setting.icon size={20} color={theme.colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{setting.title}</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{setting.subtitle}</Text>
                </View>
                <Switch
                  value={settings[setting.key] as boolean}
                  onValueChange={() => toggleSetting(setting.key)}
                  trackColor={{ false: theme.colors.border, true: `${theme.colors.primary}50` }}
                  thumbColor={settings[setting.key] ? theme.colors.primary : theme.colors.textTertiary}
                />
              </View>
            ))}
          </View>
        </View>

        {/* General Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>General</Text>
          <View style={[styles.settingsContainer, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
            {generalSettings.map((setting, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.settingItem,
                  index < generalSettings.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }
                ]}
                onPress={setting.onPress}>
                <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
                  <setting.icon size={20} color={theme.colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{setting.title}</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{setting.subtitle}</Text>
                </View>
                {setting.showArrow && (
                  <ChevronRight size={20} color={theme.colors.textTertiary} strokeWidth={2} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Development / Test data (hidden in production) */}
        {__DEV__ ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Development</Text>
            <View style={[styles.settingsContainer, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
              <TouchableOpacity
                style={styles.settingItem}
                onPress={handleSeedTestData}
                disabled={seeding}
              >
                <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.warning}20` }]}>
                  <FlaskConical size={20} color={theme.colors.warning} strokeWidth={2} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Seed test data</Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                    Add sample deliveries and notifications for testing
                  </Text>
                </View>
                {seeding ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <ChevronRight size={20} color={theme.colors.textTertiary} strokeWidth={2} />}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* App Info */}
        <View style={styles.section}>
          <View style={styles.appInfo}>
            <Text style={[styles.appName, { color: theme.colors.primary }]}>Ridely</Text>
            <Text style={[styles.appVersion, { color: theme.colors.textSecondary }]}>Version 1.0.0</Text>
            <Text style={[styles.appCopyright, { color: theme.colors.textTertiary }]}>© 2024 Ridely. All rights reserved.</Text>
          </View>
        </View>

        {/* Logout Button */}
        <View style={styles.section}>
          <TouchableOpacity style={[styles.logoutButton, { backgroundColor: theme.colors.surface, borderColor: `${theme.colors.error}30` }, theme.shadows.medium]} onPress={handleLogout}>
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
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  settingsContainer: {
    marginHorizontal: 20,
    borderRadius: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  appInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  appVersion: {
    fontSize: 16,
    marginBottom: 4,
  },
  appCopyright: {
    fontSize: 12,
    textAlign: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
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
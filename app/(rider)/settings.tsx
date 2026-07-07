import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated from 'react-native-reanimated';
import { Bell, Moon, Globe, Zap, CircleHelp as HelpCircle, FileText, Shield, LogOut, ChevronRight, Smartphone, Mail, MessageSquare, Sun, Monitor } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme, ThemeMode } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { useAlert } from '@/contexts/AlertContext';
import { staggeredCardEnter } from '@/lib/riderAnimations';
import { AnimatedPressable } from '@/components/rider/AnimatedPressable';

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
  const { signOut, loading } = useAuth();
  const { showAlert } = useAlert();
  const { languageName } = useLanguage();
  const {
    animations,
    setAnimations,
    pushNotifications,
    setPushNotifications,
    emailNotifications,
    setEmailNotifications,
    smsNotifications,
    setSmsNotifications,
  } = useAppSettings();

  const enterSection = (i: number) => (animations ? staggeredCardEnter(i) : undefined);
  const [settings, setSettings] = useState<SettingsState>({
    pushNotifications: true,
    emailNotifications: true,
    smsNotifications: false,
    animations: true,
    language: 'English',
  });

  const getNotificationValue = (key: keyof SettingsState) => {
    if (key === 'pushNotifications') return pushNotifications;
    if (key === 'emailNotifications') return emailNotifications;
    if (key === 'smsNotifications') return smsNotifications;
    return settings[key] as boolean;
  };

  const setNotificationValue = (key: keyof SettingsState, value: boolean) => {
    if (key === 'pushNotifications') setPushNotifications(value);
    else if (key === 'emailNotifications') setEmailNotifications(value);
    else if (key === 'smsNotifications') setSmsNotifications(value);
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
      onPress: () => router.push('/(rider)/language'),
      showArrow: true,
    },
    {
      title: 'Notification Schedule',
      subtitle: 'Set quiet hours',
      icon: Bell,
      onPress: () => router.push('/(rider)/notification-schedule'),
      showArrow: true,
    },
    {
      title: 'Help & Support',
      subtitle: 'Get help and contact support',
      icon: HelpCircle,
      onPress: () => router.push('/(rider)/support'),
      showArrow: true,
    },
    {
      title: 'Privacy Policy',
      subtitle: 'Read our privacy policy',
      icon: Shield,
      onPress: () => router.push('/(rider)/privacy-policy'),
      showArrow: true,
    },
    {
      title: 'Terms of Service',
      subtitle: 'Read our terms and conditions',
      icon: FileText,
      onPress: () => router.push('/(rider)/terms-of-service'),
      showArrow: true,
    },
  ];

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
        <Animated.View entering={enterSection(0)} style={[styles.header, { paddingTop: 20 + insets.top }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Settings</Text>
        </Animated.View>

        {/* Notifications Section */}
        <Animated.View entering={enterSection(1)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notifications</Text>
          <View style={[styles.settingsContainer, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
            {notificationSettings.map((setting, index) => {
              const value = getNotificationValue(setting.key);
              return (
                <View key={setting.key} style={styles.settingItem}>
                  <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
                    <setting.icon size={20} color={theme.colors.primary} strokeWidth={2} />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{setting.title}</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{setting.subtitle}</Text>
                  </View>
                  <Switch
                    value={value}
                    onValueChange={(v) => setNotificationValue(setting.key, v)}
                    trackColor={{ false: theme.colors.border, true: `${theme.colors.primary}50` }}
                    thumbColor={value ? theme.colors.primary : theme.colors.textTertiary}
                  />
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* Theme Section */}
        <Animated.View entering={enterSection(2)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Theme</Text>
          <View style={[styles.settingsContainer, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
            {themeOptions.map((option, index) => (
              <AnimatedPressable
                key={option.mode}
                style={[
                  styles.settingItem,
                  index < themeOptions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }
                ]}
                onPress={() => setThemeMode(option.mode)}
              >
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
              </AnimatedPressable>
            ))}
          </View>
        </Animated.View>
        {/* App Settings Section */}
        <Animated.View entering={enterSection(3)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>App Settings</Text>
          <View style={[styles.settingsContainer, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
            {appSettings.map((setting) => {
              const value = setting.key === 'animations' ? animations : (settings[setting.key] as boolean);
              const onToggle = setting.key === 'animations' ? () => setAnimations(!animations) : () => {};
              return (
                <View key={setting.key} style={styles.settingItem}>
                  <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
                    <setting.icon size={20} color={theme.colors.primary} strokeWidth={2} />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{setting.title}</Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>{setting.subtitle}</Text>
                  </View>
                  <Switch
                    value={value}
                    onValueChange={onToggle}
                    trackColor={{ false: theme.colors.border, true: `${theme.colors.primary}50` }}
                    thumbColor={value ? theme.colors.primary : theme.colors.textTertiary}
                  />
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* General Section */}
        <Animated.View entering={enterSection(4)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>General</Text>
          <View style={[styles.settingsContainer, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
            {generalSettings.map((setting, index) => (
              <AnimatedPressable
                key={index}
                style={[
                  styles.settingItem,
                  index < generalSettings.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }
                ]}
                onPress={setting.onPress}
              >
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
              </AnimatedPressable>
            ))}
          </View>
        </Animated.View>

        {/* App Info */}
        <Animated.View entering={enterSection(5)} style={styles.section}>
          <View style={styles.appInfo}>
            <Text style={[styles.appName, { color: theme.colors.primary }]}>Ridely</Text>
            <Text style={[styles.appVersion, { color: theme.colors.textSecondary }]}>Version 1.0.0</Text>
            <Text style={[styles.appCopyright, { color: theme.colors.textTertiary }]}>© 2024 Ridely. All rights reserved.</Text>
          </View>
        </Animated.View>

        {/* Logout Button */}
        <Animated.View entering={enterSection(6)} style={styles.section}>
          <AnimatedPressable
            style={[styles.logoutButton, { backgroundColor: theme.colors.surface, borderColor: `${theme.colors.error}30` }, theme.shadows.medium]}
            onPress={handleLogout}
          >
            <LogOut size={20} color={theme.colors.error} strokeWidth={2} />
            <Text style={[styles.logoutText, { color: theme.colors.error }]}>Logout</Text>
          </AnimatedPressable>
        </Animated.View>
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
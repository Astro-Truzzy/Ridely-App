import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  Alert,
} from 'react-native';
import { Bell, Moon, Globe, Zap, CircleHelp as HelpCircle, FileText, Shield, LogOut, ChevronRight, Smartphone, Mail, MessageSquare, Sun, Monitor } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme, ThemeMode } from '@/contexts/ThemeContext';

interface SettingsState {
  pushNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  animations: boolean;
  language: string;
}

export default function SettingsScreen() {
  const { theme, themeMode, setThemeMode } = useTheme();
  
  const [settings, setSettings] = useState<SettingsState>({
    pushNotifications: true,
    emailNotifications: true,
    smsNotifications: false,
    animations: true,
    language: 'English',
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
      subtitle: settings.language,
      icon: Globe,
      onPress: () => Alert.alert('Language', 'Language selection coming soon!'),
      showArrow: true,
    },
    {
      title: 'Notification Schedule',
      subtitle: 'Set quiet hours',
      icon: Bell,
      onPress: () => router.push('/settings/notifications'),
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
      onPress: () => Alert.alert('Privacy', 'Privacy policy coming soon!'),
      showArrow: true,
    },
    {
      title: 'Terms of Service',
      subtitle: 'Read our terms and conditions',
      icon: FileText,
      onPress: () => Alert.alert('Terms', 'Terms of service coming soon!'),
      showArrow: true,
    },
  ];

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            // Handle logout logic here
            Alert.alert('Success', 'You have been logged out');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
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
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Check } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage, LANGUAGE_OPTIONS } from '@/contexts/LanguageContext';
import { useAlert } from '@/contexts/AlertContext';

export default function LanguageScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { languageCode, setLanguage } = useLanguage();
  const { showAlert } = useAlert();

  const handleLanguageSelect = async (code: string) => {
    await setLanguage(code);
    const name = LANGUAGE_OPTIONS.find((o) => o.code === code)?.name ?? code;
    showAlert(
      'Language Updated',
      `App language changed to ${name}. This will take effect after you restart the app.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border, paddingTop: 16 + insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Language</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Select Language</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
            Choose your preferred language for the app interface
          </Text>
          
          <View style={[styles.languageContainer, { backgroundColor: theme.colors.surface }]}>
            {LANGUAGE_OPTIONS.map((language) => (
              <TouchableOpacity
                key={language.code}
                style={[
                  styles.languageItem,
                  { borderBottomColor: theme.colors.border },
                ]}
                onPress={() => handleLanguageSelect(language.code)}>
                <View style={styles.languageInfo}>
                  <Text style={[styles.languageName, { color: theme.colors.text }]}>{language.name}</Text>
                  <Text style={[styles.languageNative, { color: theme.colors.textSecondary }]}>{language.nativeName}</Text>
                </View>
                {languageCode === language.code && (
                  <View style={[styles.checkContainer, { backgroundColor: theme.colors.primary }]}>
                    <Check size={16} color="#FFFFFF" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.noteContainer}>
          <Text style={[styles.noteText, { color: theme.colors.textSecondary }]}>
            Note: Some translations may not be available for all content. We're constantly working to improve our language support.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
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
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  languageContainer: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  languageNative: {
    fontSize: 14,
  },
  checkContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteContainer: {
    paddingHorizontal: 20,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
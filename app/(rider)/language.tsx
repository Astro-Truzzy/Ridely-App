import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Check,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

interface LanguageOption {
  id: string;
  code: string;
  name: string;
  nativeName: string;
}

export default function LanguageScreen() {
  const { theme } = useTheme();
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  const languages: LanguageOption[] = [
    {
      id: 'en',
      code: 'en',
      name: 'English',
      nativeName: 'English',
    },
    {
      id: 'es',
      code: 'es',
      name: 'Spanish',
      nativeName: 'Español',
    },
    {
      id: 'fr',
      code: 'fr',
      name: 'French',
      nativeName: 'Français',
    },
    {
      id: 'de',
      code: 'de',
      name: 'German',
      nativeName: 'Deutsch',
    },
    {
      id: 'it',
      code: 'it',
      name: 'Italian',
      nativeName: 'Italiano',
    },
    {
      id: 'pt',
      code: 'pt',
      name: 'Portuguese',
      nativeName: 'Português',
    },
    {
      id: 'ru',
      code: 'ru',
      name: 'Russian',
      nativeName: 'Русский',
    },
    {
      id: 'zh',
      code: 'zh',
      name: 'Chinese',
      nativeName: '中文',
    },
    {
      id: 'ja',
      code: 'ja',
      name: 'Japanese',
      nativeName: '日本語',
    },
  ];

  const handleLanguageSelect = (languageCode: string) => {
    setSelectedLanguage(languageCode);
    Alert.alert(
      'Language Updated',
      `App language changed to ${languages.find(lang => lang.code === languageCode)?.name}. This will take effect after you restart the app.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
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
            {languages.map((language) => (
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
                {selectedLanguage === language.code && (
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
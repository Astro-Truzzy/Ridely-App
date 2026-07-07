import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@ridely/rider_language';

export const LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
] as const;

const DEFAULT_CODE = 'en';

interface LanguageContextType {
  languageCode: string;
  languageName: string;
  setLanguage: (code: string) => Promise<void>;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [languageCode, setLanguageCode] = useState(DEFAULT_CODE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (mounted && stored != null && LANGUAGE_OPTIONS.some((o) => o.code === stored)) {
          setLanguageCode(stored);
        }
      } catch (e) {
        // keep default
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = useCallback(async (code: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, code);
      setLanguageCode(code);
    } catch (e) {
      console.error('Failed to save language:', e);
    }
  }, []);

  const languageName = LANGUAGE_OPTIONS.find((o) => o.code === languageCode)?.name ?? 'English';

  const value: LanguageContextType = {
    languageCode,
    languageName,
    setLanguage,
    isLoading,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (ctx === undefined) {
    return {
      languageCode: DEFAULT_CODE,
      languageName: 'English',
      setLanguage: async () => {},
      isLoading: false,
    };
  }
  return ctx;
}

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Theme {
  colors: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    card: string;
    text: string;
    textTit: string;
    textSecondary: string;
    textTertiary: string;
    textThird: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  shadows: {
    small: object;
    medium: object;
    large: object;
  };
}

const lightTheme: Theme = {
  colors: {
    primary: '#174AFF',
    accent: '#FFC947',
    background: '#F7F8FA',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    text: '#1F2937',
    textTit: '#636161ff',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    textThird: '#6b6c6dff',
    border: '#E5E7EB',
    success: '#10B981',
    warning: '#FFC947',
    error: '#EF4444',
    info: '#3B82F6',
  },
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 6,
    },
  },
};

const darkTheme: Theme = {
  colors: {
    primary: '#175aff',
    accent: '#FBBF24',
    background: '#111827',
    surface: '#1F2937',
    card: '#374151',
    text: '#ffffffff',
    textTit: '#636161ff',
    textSecondary: '#818285ff',
    textThird: '#f9fafdff',
    textTertiary: '#9CA3AF',
    border: '#4B5563',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',
  },
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
  },
};

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme()
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(colorScheme);
    });

    return () => subscription?.remove();
  }, []);

  const isDark = 
    themeMode === 'dark' || 
    (themeMode === 'system' && systemColorScheme === 'dark');

  const theme = isDark ? darkTheme : lightTheme;

  const value: ThemeContextType = {
    theme,
    themeMode,
    isDark,
    setThemeMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
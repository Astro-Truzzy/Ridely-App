import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FONT_SCALE_OPTIONS,
  DEFAULT_FONT_SCALE_INDEX,
  normalizeFontScaleIndex,
  clampFontScaleIndex,
  type FontScaleId,
} from '@/lib/typography';

const STORAGE_KEY = '@ridely/font_scale';

export { FONT_SCALE_OPTIONS };
export type { FontScaleId };

interface TypographyContextType {
  fontScale: number;
  fontScaleIndex: number;
  setFontScaleIndex: (index: number) => Promise<void>;
  isLoading: boolean;
}

const TypographyContext = createContext<TypographyContextType | undefined>(undefined);

/**
 * Device-wide accessibility text size, shared by the customer and rider apps.
 * The 1.5 ceiling keeps text inside the app's fixed-height rows (the tab bar is
 * height 64).
 */
export function TypographyProvider({ children }: { children: ReactNode }) {
  const [fontScaleIndex, setIndex] = useState(DEFAULT_FONT_SCALE_INDEX);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (mounted && stored != null) setIndex(normalizeFontScaleIndex(stored));
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

  const setFontScaleIndex = useCallback(async (index: number) => {
    const safe = clampFontScaleIndex(index);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(FONT_SCALE_OPTIONS[safe].scale));
    } catch (e) {
      console.error('Failed to save font scale:', e);
    }
    setIndex(safe);
  }, []);

  const value: TypographyContextType = {
    fontScale: FONT_SCALE_OPTIONS[fontScaleIndex].scale,
    fontScaleIndex,
    setFontScaleIndex,
    isLoading,
  };

  return <TypographyContext.Provider value={value}>{children}</TypographyContext.Provider>;
}

export function useTypography(): TypographyContextType {
  const ctx = useContext(TypographyContext);
  if (ctx === undefined) {
    return {
      fontScale: 1,
      fontScaleIndex: DEFAULT_FONT_SCALE_INDEX,
      setFontScaleIndex: async () => {},
      isLoading: false,
    };
  }
  return ctx;
}

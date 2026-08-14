import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@ridely/rider_app_settings';

interface AppSettingsState {
  animations: boolean;
  pushNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  receiptNotifications: boolean;
}

const defaults: AppSettingsState = {
  animations: true,
  pushNotifications: true,
  emailNotifications: true,
  smsNotifications: false,
  receiptNotifications: true,
};

interface AppSettingsContextType extends AppSettingsState {
  setAnimations: (value: boolean) => Promise<void>;
  setPushNotifications: (value: boolean) => Promise<void>;
  setEmailNotifications: (value: boolean) => Promise<void>;
  setSmsNotifications: (value: boolean) => Promise<void>;
  setReceiptNotifications: (value: boolean) => Promise<void>;
  isLoading: boolean;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppSettingsState>(defaults);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (mounted && raw) {
          const parsed = JSON.parse(raw) as Partial<AppSettingsState>;
          setState((prev) => ({
            ...prev,
            ...(typeof parsed.animations === 'boolean' && { animations: parsed.animations }),
            ...(typeof parsed.pushNotifications === 'boolean' && { pushNotifications: parsed.pushNotifications }),
            ...(typeof parsed.emailNotifications === 'boolean' && { emailNotifications: parsed.emailNotifications }),
            ...(typeof parsed.smsNotifications === 'boolean' && { smsNotifications: parsed.smsNotifications }),
            ...(typeof parsed.receiptNotifications === 'boolean'
              ? { receiptNotifications: parsed.receiptNotifications }
              : typeof parsed.emailNotifications === 'boolean'
                ? { receiptNotifications: parsed.emailNotifications }
                : {}),
          }));
        }
      } catch {
        // keep defaults
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const persist = useCallback(async (next: AppSettingsState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('Failed to save app settings:', e);
    }
  }, []);

  const patch = useCallback((partial: Partial<AppSettingsState>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      persist(next);
      return next;
    });
  }, [persist]);

  const setAnimations = useCallback(async (value: boolean) => { patch({ animations: value }); }, [patch]);
  const setPushNotifications = useCallback(async (value: boolean) => { patch({ pushNotifications: value }); }, [patch]);
  const setEmailNotifications = useCallback(async (value: boolean) => { patch({ emailNotifications: value }); }, [patch]);
  const setSmsNotifications = useCallback(async (value: boolean) => { patch({ smsNotifications: value }); }, [patch]);
  const setReceiptNotifications = useCallback(async (value: boolean) => { patch({ receiptNotifications: value }); }, [patch]);

  const value: AppSettingsContextType = {
    ...state,
    setAnimations,
    setPushNotifications,
    setEmailNotifications,
    setSmsNotifications,
    setReceiptNotifications,
    isLoading,
  };

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsContextType {
  const ctx = useContext(AppSettingsContext);
  if (ctx === undefined) {
    return {
      ...defaults,
      setAnimations: async () => {},
      setPushNotifications: async () => {},
      setEmailNotifications: async () => {},
      setSmsNotifications: async () => {},
      setReceiptNotifications: async () => {},
      isLoading: false,
    };
  }
  return ctx;
}

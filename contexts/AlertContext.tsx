import React, { createContext, useCallback, useContext, useState, ReactNode, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
}

export type ToastKind = 'success' | 'error' | 'info';

interface ToastState {
  visible: boolean;
  message: string;
  kind: ToastKind;
}

interface AlertContextType {
  showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void;
  showToast: (message: string, kind?: ToastKind) => void;
}

const defaultButtons: AlertButton[] = [{ text: 'OK' }];

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<AlertState>({
    visible: false,
    title: '',
    message: '',
    buttons: defaultButtons,
  });
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    kind: 'success',
  });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showAlert = useCallback(
    (title: string, message?: string, buttons?: AlertButton[]) => {
      setState({
        visible: true,
        title,
        message: message ?? '',
        buttons: buttons && buttons.length > 0 ? buttons : defaultButtons,
      });
    },
    []
  );

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, message, kind });
    toastTimer.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2800);
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const handlePress = useCallback(
    (button: AlertButton) => {
      close();
      button.onPress?.();
    },
    [close]
  );

  const { visible, title, message, buttons } = state;

  const toastBg =
    toast.kind === 'error'
      ? theme.colors.error
      : toast.kind === 'info'
        ? theme.colors.text
        : '#059669';

  return (
    <AlertContext.Provider value={{ showAlert, showToast }}>
      {children}
      {toast.visible ? (
        <View
          pointerEvents="none"
          style={[styles.toastWrap, { bottom: 24 + insets.bottom }]}
        >
          <View style={[styles.toast, { backgroundColor: toastBg }]}>
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        </View>
      ) : null}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
      >
        <Pressable style={styles.overlay} onPress={close}>
          <Pressable
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
              theme.shadows.large,
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {title}
            </Text>
            {message ? (
              <Text
                style={[styles.message, { color: theme.colors.textSecondary }]}
              >
                {message}
              </Text>
            ) : null}
            <View style={[styles.actions, { borderTopColor: theme.colors.border }]}>
              {buttons.map((btn, index) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel = btn.style === 'cancel';
                const color = isDestructive
                  ? theme.colors.error
                  : isCancel
                    ? theme.colors.textSecondary
                    : theme.colors.primary;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      index > 0 && [styles.buttonBorder, { borderLeftColor: theme.colors.border }],
                    ]}
                    onPress={() => handlePress(btn)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.buttonText, { color }]}>{btn.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextType {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}

const { width } = Dimensions.get('window');
const cardWidth = Math.min(width - 48, 340);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: cardWidth,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBorder: {
    borderLeftWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  toastWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    maxWidth: 420,
    width: '100%',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

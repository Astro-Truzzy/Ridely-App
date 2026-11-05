import React, { useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/Text';
import { AlertCircle, X } from 'lucide-react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

export interface AuthErrorBadgeAction {
  label: string;
  onPress: () => void;
}

interface AuthErrorBadgeProps {
  visible: boolean;
  title: string;
  message?: string;
  action?: AuthErrorBadgeAction;
  onDismiss: () => void;
  /** How long (ms) before the badge auto-dismisses. Defaults to 5000. */
  durationMs?: number;
  /** Extra offset below the safe-area top. Defaults to 8. */
  topOffset?: number;
}

/**
 * Floating error badge that slides down from the top of the screen.
 * Used for auth-level failures (wrong credentials, email already in use)
 * so they stand out from inline field-validation errors.
 */
export function AuthErrorBadge({
  visible,
  title,
  message,
  action,
  onDismiss,
  durationMs = 5000,
  topOffset = 8,
}: AuthErrorBadgeProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => dismissRef.current(), durationMs);
    return () => clearTimeout(timer);
  }, [visible, durationMs, title, message]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      exiting={FadeOutUp.duration(200)}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + topOffset }]}
    >
      <View
        style={[
          styles.badge,
          {
            backgroundColor: theme.colors.error,
            ...theme.shadows.large,
          },
        ]}
      >
        <AlertCircle size={20} color="#FFFFFF" strokeWidth={2.5} />
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {action ? (
            <TouchableOpacity
              onPress={action.onPress}
              hitSlop={8}
              activeOpacity={0.8}
            >
              <Text style={styles.action}>{action.label}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={12}
          accessibilityLabel="Dismiss error"
          accessibilityRole="button"
          style={styles.close}
          activeOpacity={0.7}
        >
          <X size={16} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 50,
    elevation: 50,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: 13,
    lineHeight: 18,
  },
  action: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
    marginTop: 4,
  },
  close: {
    padding: 4,
  },
});

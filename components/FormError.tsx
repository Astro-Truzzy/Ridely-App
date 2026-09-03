import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

export function FormError({ message }: { message?: string | null }) {
  const { theme } = useTheme();
  if (!message) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={styles.row}
    >
      <AlertCircle size={14} color={theme.colors.error} />
      <Text style={[styles.text, { color: theme.colors.error }]}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
    gap: 6,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});

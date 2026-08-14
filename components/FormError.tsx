import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export function FormError({ message }: { message?: string | null }) {
  const { theme } = useTheme();
  if (!message) return null;
  return <Text style={[styles.text, { color: theme.colors.error }]}>{message}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
    lineHeight: 18,
  },
});

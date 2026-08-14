import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { isPaystackTestMode } from '@/lib/paystackMode';
import { useTheme } from '@/contexts/ThemeContext';

export function TestPaymentsBanner({ compact = false }: { compact?: boolean }) {
  const { isDark } = useTheme();
  if (!isPaystackTestMode()) return null;
  return (
    <View
      style={[
        styles.banner,
        compact && styles.compact,
        {
          backgroundColor: isDark ? '#3D2A14' : '#FFF7ED',
          borderColor: isDark ? '#9A3412' : '#FDBA74',
        },
      ]}
    >
      <Text style={styles.title}>Test payments</Text>
      <Text style={styles.body}>
        Paystack is in test mode. Use Paystack test cards — live cards will fail.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  compact: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 12,
  },
  title: {
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '800',
  },
  body: {
    color: '#9A3412',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
});

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/useOnboarding';
import { OpeningSplash } from '@/components/OpeningSplash';

const MIN_DISPLAY_MS = 3200;

export default function LoadingScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const { hasCompletedOnboarding, isLoading: onboardingLoading } =
    useOnboarding();
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (authLoading || onboardingLoading) return;

    const navigate = () => {
      if (session) {
        router.replace('/');
        return;
      }

      if (hasCompletedOnboarding) {
        router.replace('/(auth)/welcome');
      } else {
        router.replace('/(auth)/onboarding');
      }
    };

    const delay = Math.max(
      0,
      MIN_DISPLAY_MS - (Date.now() - startedAt.current),
    );
    const timer = setTimeout(navigate, delay);

    return () => clearTimeout(timer);
  }, [session, authLoading, onboardingLoading, hasCompletedOnboarding, router]);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OpeningSplash />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

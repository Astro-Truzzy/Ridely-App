import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Image } from 'react-native';
import { useLogo } from '@/hooks/useLogo';
import { useOnboarding } from '@/hooks/useOnboarding';

export default function LoadingScreen() {
  const { theme } = useTheme();
  const { logo } = useLogo();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const { hasCompletedOnboarding, isLoading: onboardingLoading } = useOnboarding();

  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );

    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.7, { duration: 800 })
      ),
      -1,
      false
    );
  }, []);

  useEffect(() => {
    if (authLoading || onboardingLoading) return;

    const minDisplayTime = 1500;
    const startTime = Date.now();

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

    const elapsed = Date.now() - startTime;
    const delay = Math.max(0, minDisplayTime - elapsed);
    const timer = setTimeout(navigate, delay);

    return () => clearTimeout(timer);
  }, [session, authLoading, onboardingLoading, hasCompletedOnboarding]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 40,
    },
    logo: {
      width: 160,
      height: 160,
      resizeMode: 'contain',
      marginBottom: 24,
    },
    logoImage: {
      width: 140,
      height: 140,
      borderRadius: 70,
      resizeMode: 'contain',
    },
    logoText: {
      fontSize: 32,
      fontWeight: 'bold',
      color: 'white',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Animated.View style={[styles.logo, animatedStyle]}>
          <Image source={logo} style={styles.logoImage} />
        </Animated.View>
        <Text style={styles.title}>Ridely{'\n'}</Text>
      </View>
    </View>
  );
}

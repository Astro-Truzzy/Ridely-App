import React from 'react';
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
import { Image } from 'react-native';
import { useLogo } from '@/hooks/useLogo';

export default function LoadingScreen() {
  const { theme } = useTheme();
  const { logo } = useLogo();
  const router = useRouter();

  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.7);

  React.useEffect(() => {
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

    // Navigate to onboarding after 3 seconds
    const timer = setTimeout(() => {
      router.replace('/(auth)/onboarding');
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

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
      width: 120,
      height: 120,
      resizeMode: 'contain',
      marginBottom: 20,
    },
    logoImage: {
      width: 90,
      height: 90,
      borderRadius: 45,
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

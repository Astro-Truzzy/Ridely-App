import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLogo } from '@/hooks/useLogo';
import { AuthBackgroundLines } from '@/components/AuthBackgroundLines';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { logo } = useLogo();

  // Removed duplicate features - onboarding already covers these

  const buttonScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthBackgroundLines />
      <View style={[styles.content, { paddingTop: insets.top }]}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Image source={logo} style={styles.logoImage} />
          <Text style={[styles.logoText, { color: theme.colors.text }]}>
            Ridely
          </Text>
          <Text style={[styles.tagline, { color: theme.colors.textThird }]}>
            Fast. Reliable. Delivered.
          </Text>
        </View>

        {/* CTA Section */}
        <Animated.View
          entering={FadeInUp.duration(600).delay(200)}
          style={styles.ctaSection}
        >
          <Text style={[styles.ctaTitle, { color: theme.colors.text }]}>
            Ready to get started?
          </Text>
          <Text
            style={[styles.ctaSubtitle, { color: theme.colors.textSecondary }]}
          >
            Join thousands of users sending packages across the city
          </Text>
        </Animated.View>

        {/* Buttons Section */}
        <Animated.View entering={FadeInUp.duration(600).delay(400)}>
          <Pressable
            onPressIn={() => {
              buttonScale.value = withSpring(0.95);
            }}
            onPressOut={() => {
              buttonScale.value = withSpring(1);
            }}
            onPress={() => router.push('/(auth)/signup')}
          >
            <Animated.View style={[styles.button, animatedStyle]}>
              <Text style={styles.buttonText}>Create Account</Text>
            </Animated.View>
          </Pressable>
        </Animated.View>

        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <Text style={[styles.loginText, { color: theme.colors.primary }]}>
            Already have an account? Sign In
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  logoImage: {
    width: 140,
    height: 140,
    resizeMode: 'contain',
    marginBottom: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 48,
    zIndex: 1,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoText: {
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 8,
    opacity: 0.85,
  },
  ctaSection: {
    marginBottom: 40,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  ctaSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#5A47FF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#5A47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  loginText: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
    textDecorationLine: 'underline',
  },
});

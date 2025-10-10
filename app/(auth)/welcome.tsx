import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Pressable,
} from 'react-native';
import { Package, Zap, Shield, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLogo } from '@/hooks/useLogo';
import Animated, { FadeInUp, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const { theme } = useTheme();
  const { logo } = useLogo();

  const features = [
    {
      icon: Package,
      title: 'Fast Delivery',
      description: 'Send packages anywhere in the city with motorcycle riders',
    },
    {
      icon: Clock,
      title: 'Real-time Tracking',
      description: 'Track your delivery live and chat with your rider',
    },
    {
      icon: Shield,
      title: 'Secure & Insured',
      description: 'All packages are insured up to $100 for your peace of mind',
    },
  ];

  const buttonScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']} // Customize edges as needed
    >
      <View style={styles.content}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Image source={logo} style={styles.logoImage} />
          <Text style={[styles.logoText, { color: theme.colors.text }]}>Ridely</Text>
          <Text style={[styles.tagline, { color: theme.colors.textSecondary }]}>Fast. Reliable. Delivered.</Text>
        </View>

        {/* Features Section */}
        <View style={styles.featuresContainer}>
          {features.map((feature, idx) => (
            <Animated.View key={feature.title} entering={FadeInUp.duration(600)} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <feature.icon color={theme.colors.primary} size={28} />
              </View>
              <View style={styles.featureContent}>
                <Text style={[styles.featureTitle, { color: theme.colors.text }]}>{feature.title}</Text>
                <Text style={[styles.featureDescription, { color: theme.colors.textSecondary }]}>{feature.description}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Buttons Section */}
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

        <TouchableOpacity
          onPress={() => router.push('/(auth)/login')}
        >
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
    width: 80,
    height: 80,
    resizeMode: 'contain',
    marginBottom: 12,
    // No border/background for modern look
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 48,
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
  featuresContainer: {
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 22,
    marginBottom: 18,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 15,
    opacity: 0.8,
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

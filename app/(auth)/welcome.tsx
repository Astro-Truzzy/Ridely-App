import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Package, Zap, Shield, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function WelcomeScreen() {
  const { theme } = useTheme();

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={[styles.logoContainer, { backgroundColor: theme.colors.primary }]}>
            <Package size={48} color="#FFFFFF" strokeWidth={2} />
          </View>
          <Text style={[styles.logoText, { color: theme.colors.text }]}>Ridely</Text>
          <Text style={[styles.tagline, { color: theme.colors.textSecondary }]}>Fast. Reliable. Delivered.</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <feature.icon size={24} color={theme.colors.primary} strokeWidth={2} />
              </View>
              <View style={styles.featureContent}>
                <Text style={[styles.featureTitle, { color: theme.colors.text }]}>{feature.title}</Text>
                <Text style={[styles.featureDescription, { color: theme.colors.textSecondary }]}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Illustration Placeholder */}
        <View style={styles.illustrationContainer}>
          <View style={styles.illustration}>
            <Zap size={64} color={theme.colors.primary} strokeWidth={2} />
            <Text style={[styles.illustrationText, { color: theme.colors.primary }]}>Ready to get started?</Text>
          </View>
        </View>
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.signupButton, { backgroundColor: theme.colors.primary }, theme.shadows.medium]}
          onPress={() => router.push('/(auth)/signup')}>
          <Text style={styles.signupText}>Create Account</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => router.push('/(auth)/login')}>
          <Text style={[styles.loginText, { color: theme.colors.primary }]}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '500',
  },
  featuresContainer: {
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  illustrationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustration: {
    alignItems: 'center',
    opacity: 0.8,
  },
  illustrationText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  signupButton: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  signupText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loginButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
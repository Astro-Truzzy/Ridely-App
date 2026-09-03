import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Mail, Package, Send } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import { supabase } from '@/lib/supabase';
import { getAuthRedirectUrl } from '@/lib/authRedirect';
import { FormError } from '@/components/FormError';
import { AuthBackgroundLines } from '@/components/AuthBackgroundLines';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { showToast } = useAlert();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleResetPassword = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setFormError('Please enter your email address');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Please enter a valid email address');
      return;
    }

    setFormError(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        {
          redirectTo: getAuthRedirectUrl('reset-password'),
        },
      );

      if (error) throw error;

      showToast(
        "If an account exists for that email, we've sent a reset link.",
      );
      router.back();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Could not send the reset link. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const buttonScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    keyboardAvoidingView: {
      flex: 1,
      zIndex: 1,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      ...theme.shadows.medium,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      justifyContent: 'center',
    },
    logoSection: {
      alignItems: 'center',
      marginBottom: 48,
    },
    logoImage: {
      width: 120,
      height: 120,
      resizeMode: 'contain',
      marginBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: 20,
    },
    form: {
      marginBottom: 32,
    },
    inputGroup: {
      marginBottom: 24,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.shadows.small,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
      marginLeft: 12,
    },
    resetButton: {
      flexDirection: 'row',
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.medium,
    },
    resetButtonDisabled: {
      backgroundColor: theme.colors.textTertiary,
    },
    resetButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      marginLeft: 8,
    },
    helpContainer: {
      alignItems: 'center',
    },
    helpText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    helpLink: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthBackgroundLines />
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoSection}>
            <Package
              size={48}
              color={theme.colors.primary}
              strokeWidth={2}
              style={{ marginBottom: 12 }}
            />
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              Don't worry! Enter your email address and we'll send you a link to
              reset your password.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View
                style={[
                  styles.inputContainer,
                  formError ? { borderColor: theme.colors.error } : null,
                ]}
              >
                <Mail
                  size={20}
                  color={
                    formError ? theme.colors.error : theme.colors.textSecondary
                  }
                  strokeWidth={2}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    setFormError(null);
                  }}
                  onBlur={() => {
                    const trimmed = email.trim();
                    if (!trimmed) {
                      setFormError('Please enter your email address');
                    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
                      setFormError('Please enter a valid email address');
                    }
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  editable={!isLoading}
                />
              </View>
              <FormError message={formError} />
            </View>

            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              <Animated.View
                style={[
                  styles.resetButton,
                  isLoading && styles.resetButtonDisabled,
                  animatedStyle,
                ]}
              >
                <Send size={20} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.resetButtonText}>
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </Text>
              </Animated.View>
            </Pressable>
          </View>

          {/* Help Text */}
          <View style={styles.helpContainer}>
            <Text style={styles.helpText}>
              Remember your password?{' '}
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.helpLink}>Back to Sign In</Text>
              </TouchableOpacity>
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

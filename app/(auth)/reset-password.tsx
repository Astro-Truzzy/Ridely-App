import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  Lock,
  Package,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import { supabase } from '@/lib/supabase';
import { createSessionFromRedirectUrl } from '@/lib/socialAuth';
import { FormError } from '@/components/FormError';
import { AuthBackgroundLines } from '@/components/AuthBackgroundLines';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { showToast } = useAlert();

  const [verifying, setVerifying] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const establishSession = async (url: string) => {
      try {
        await createSessionFromRedirectUrl(url);
        if (!active) return;
        setSessionReady(true);
        setLinkError(null);
      } catch (e) {
        if (!active) return;
        setLinkError(
          e instanceof Error
            ? e.message
            : 'This reset link is invalid or has expired.',
        );
      } finally {
        if (active) setVerifying(false);
      }
    };

    const bootstrap = async () => {
      // Cold start: the app was opened directly from the email link.
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && initialUrl.includes('reset-password')) {
        await establishSession(initialUrl);
        return;
      }

      // Already authenticated (e.g. recovery session already set) — allow update.
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        setSessionReady(true);
        setVerifying(false);
        return;
      }

      // No link and no session — wait briefly for a warm-start deep link event.
      setVerifying(false);
      setLinkError('Open the password reset link from your email to continue.');
    };

    // Warm start: app already running when the deep link arrives.
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url && url.includes('reset-password')) {
        setVerifying(true);
        establishSession(url);
      }
    });

    bootstrap();

    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  const handleUpdatePassword = async () => {
    if (!password || !confirmPassword) {
      setFormError('Please fill in both password fields.');
      return;
    }
    if (password.length < 8) {
      setFormError('Your new password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('The passwords do not match.');
      return;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // Clear the temporary recovery session so the user signs in fresh.
      await supabase.auth.signOut();

      showToast('Password updated. Please sign in with your new password.');
      router.replace('/(auth)/login');
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Could not update your password. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const buttonScale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

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
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 12,
    },
    logoSection: {
      alignItems: 'center',
      marginBottom: 40,
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
      marginBottom: 20,
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
    linkButton: {
      marginTop: 20,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: theme.colors.primary,
    },
    linkButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
  });

  const renderBody = () => {
    if (verifying) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.subtitle, { marginTop: 8 }]}>
            Verifying your reset link…
          </Text>
        </View>
      );
    }

    if (!sessionReady) {
      return (
        <View style={styles.centered}>
          <Package size={48} color={theme.colors.primary} strokeWidth={2} />
          <Text style={styles.title}>Link Expired</Text>
          <Text style={styles.subtitle}>
            {linkError ?? 'This password reset link is invalid or has expired.'}
          </Text>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.replace('/(auth)/forgot-password')}
          >
            <Text style={styles.linkButtonText}>Request a new link</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.content}>
        <View style={styles.logoSection}>
          <Package
            size={48}
            color={theme.colors.primary}
            strokeWidth={2}
            style={{ marginBottom: 12 }}
          />
          <Text style={styles.title}>Set New Password</Text>
          <Text style={styles.subtitle}>
            Choose a strong new password for your Ridely account.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>New Password</Text>
            <View style={styles.inputContainer}>
              <Lock
                size={20}
                color={theme.colors.textSecondary}
                strokeWidth={2}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter new password"
                placeholderTextColor={theme.colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSaving}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                {showPassword ? (
                  <EyeOff
                    size={20}
                    color={theme.colors.textSecondary}
                    strokeWidth={2}
                  />
                ) : (
                  <Eye
                    size={20}
                    color={theme.colors.textSecondary}
                    strokeWidth={2}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={styles.inputContainer}>
              <Lock
                size={20}
                color={theme.colors.textSecondary}
                strokeWidth={2}
              />
              <TextInput
                style={styles.input}
                placeholder="Re-enter new password"
                placeholderTextColor={theme.colors.textTertiary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSaving}
              />
            </View>
          </View>

          <FormError message={formError} />

          <Pressable
            onPressIn={() => (buttonScale.value = withSpring(0.95))}
            onPressOut={() => (buttonScale.value = withSpring(1))}
            onPress={handleUpdatePassword}
            disabled={isSaving}
          >
            <Animated.View
              style={[
                styles.resetButton,
                isSaving && styles.resetButtonDisabled,
                animatedStyle,
              ]}
            >
              <Check size={20} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.resetButtonText}>
                {isSaving ? 'Updating…' : 'Update Password'}
              </Text>
            </Animated.View>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthBackgroundLines />
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/(auth)/login')}
          >
            <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        {renderBody()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

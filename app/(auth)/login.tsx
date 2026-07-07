import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Package,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { useLogo } from '@/hooks/useLogo';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { GoogleLogo, FacebookLogo, AppleLogo } from '@/lib/SocialIcons';
import { getEnabledOAuthProviders, OAuthProvider, startOAuth } from '@/lib/socialAuth';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { logo } = useLogo();
  const { signIn } = useAuth();
  const { showAlert } = useAlert();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Error', 'Please fill in all fields');
      return;
    }

    if (!email.includes('@')) {
      showAlert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      await signIn(email, password);
      // Navigation will be handled automatically by the auth state change in index.tsx
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = 'Failed to sign in';
      
      // Use the error message from signIn if available
      if (error.message) {
        errorMessage = error.message;
      } else if (error.includes && error.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.includes && error.includes('Email not confirmed')) {
        errorMessage = 'Please confirm your email address before signing in.';
      }

      showAlert('Login Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const enabledProviders = getEnabledOAuthProviders();

  const [isSocialLoading, setIsSocialLoading] = useState(false);

  const handleSocialLogin = async (provider: OAuthProvider) => {
    setIsSocialLoading(true);
    try {
      const result = await startOAuth(provider);
      if (result === 'cancel') {
        showAlert('Social Login', 'Sign-in was cancelled.');
        return;
      }
      router.replace('/');
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : 'Social login could not be started. Check provider setup in Supabase.';
      showAlert('Social Login', msg);
    } finally {
      setIsSocialLoading(false);
    }
  };

  // Animated scale for button feedback
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withSpring(scale.value) }],
    };
  });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
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

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoSection}>
            <Image source={logo} style={styles.logoImage} />
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Welcome Back
            </Text>
            <Text
              style={[styles.subtitle, { color: theme.colors.textSecondary }]}
            >
              Sign in to your Ridely account
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Email Address
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Mail
                  size={20}
                  color={theme.colors.textSecondary}
                  strokeWidth={2}
                />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="Enter your email"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Password
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Lock
                  size={20}
                  color={theme.colors.textSecondary}
                  strokeWidth={2}
                />
                <TextInput
                  style={[styles.passwordInput, { color: theme.colors.text }]}
                  placeholder="Enter your password"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
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

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text
                style={[
                  styles.forgotPasswordText,
                  { color: theme.colors.primary },
                ]}
              >
                Forgot Password?
              </Text>
            </TouchableOpacity>

            <Pressable
              onPressIn={() => (scale.value = 0.95)}
              onPressOut={() => (scale.value = 1)}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <Animated.View
                style={[
                  styles.loginButton,
                  { backgroundColor: theme.colors.primary },
                  isLoading && { backgroundColor: theme.colors.textTertiary },
                  animatedStyle,
                ]}
              >
                <Text style={styles.loginButtonText}>
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Text>
              </Animated.View>
            </Pressable>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View
              style={[
                styles.dividerLine,
                { backgroundColor: theme.colors.border },
              ]}
            />
            <Text
              style={[
                styles.dividerText,
                { color: theme.colors.textSecondary },
              ]}
            >
              Or continue with
            </Text>
            <View
              style={[
                styles.dividerLine,
                { backgroundColor: theme.colors.border },
              ]}
            />
          </View>

          {/* Social Login */}
          {enabledProviders.length > 0 ? (
            <View style={styles.socialContainer}>
              {enabledProviders.includes('google') ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[
                    styles.socialButton,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      ...theme.shadows?.small,
                    },
                  ]}
                  onPress={() => handleSocialLogin('google')}
                  disabled={isSocialLoading || isLoading}
                >
                  <View style={styles.socialIconWrapper}>
                    <GoogleLogo size={26} />
                  </View>
                </TouchableOpacity>
              ) : null}
              {enabledProviders.includes('facebook') ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[
                    styles.socialButton,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      ...theme.shadows?.small,
                    },
                  ]}
                  onPress={() => handleSocialLogin('facebook')}
                >
                  <View style={styles.socialIconWrapper}>
                    <FacebookLogo size={26} color={theme.colors.text} />
                  </View>
                </TouchableOpacity>
              ) : null}
              {enabledProviders.includes('apple') ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[
                    styles.socialButton,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      ...theme.shadows?.small,
                    },
                  ]}
                  onPress={() => handleSocialLogin('apple')}
                >
                  <View style={styles.socialIconWrapper}>
                    <AppleLogo size={26} color={theme.colors.text} />
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.socialDisabledText, { color: theme.colors.textSecondary }]}>
              Social sign-in is currently unavailable.
            </Text>
          )}
        </View>

          {/* Sign up prompt – below form, scrolls with content so it stays visible above keyboard */}
          <View style={styles.bottomContainer}>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')} activeOpacity={0.7}>
              <Text style={[styles.signupText, { color: theme.colors.textSecondary }]}>
                Don't have an account?{' '}
                <Text
                  style={[styles.signupLink, { color: theme.colors.primary }]}
                >
                  Sign Up
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
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
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  eyeButton: {
    padding: 4,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
    paddingHorizontal: 16,
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  socialButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  socialIconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialDisabledText: {
    textAlign: 'center',
    marginTop: -6,
    marginBottom: 12,
    fontSize: 13,
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupText: {
    fontSize: 15,
  },
  signupLink: {
    fontWeight: '600',
  },
});

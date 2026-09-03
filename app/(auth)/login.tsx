import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import loginRider from '@/assets/images/login-rider.png';
import loginCloud from '@/assets/images/login-cloud.png';
import Animated, {
  cancelAnimation,
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GoogleLogo, FacebookLogo, AppleLogo } from '@/lib/SocialIcons';
import {
  getEnabledOAuthProviders,
  OAuthProvider,
  startOAuth,
} from '@/lib/socialAuth';
import { openEmailApp, resendSignupConfirmation } from '@/lib/emailInbox';
import { FormError } from '@/components/FormError';
import { validateEmail } from '@/utils/validation';

const ENTER_SPRING = { damping: 18, stiffness: 92, mass: 0.9 };
const CLOUD_WIDTH = 132;
const CLOUD_DURATION_MS = 26000;

function isEmailUnconfirmedError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('email not confirmed') ||
    lower.includes('confirm your email')
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { theme } = useTheme();
  const { signIn } = useAuth();
  const { showAlert, showToast } = useAlert();
  const heroHeight = Math.round(
    Math.max(236, Math.min(304, windowHeight * 0.34)),
  );
  const heroBackground = '#0768BE';
  const heroForeground = '#FFFFFF';
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(
    typeof params.email === 'string' ? params.email : '',
  );
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ email: false, password: false });

  const riderTranslateY = useSharedValue(-132);
  const sheetTranslateY = useSharedValue(Math.round(windowHeight * 0.58));
  const cloudTranslateX = useSharedValue(windowWidth);
  const scale = useSharedValue(1);

  useEffect(() => {
    riderTranslateY.value = withSpring(0, ENTER_SPRING);
    sheetTranslateY.value = withSpring(0, ENTER_SPRING);
  }, [riderTranslateY, sheetTranslateY]);

  useEffect(() => {
    cloudTranslateX.value = windowWidth;
    cloudTranslateX.value = withRepeat(
      withTiming(-CLOUD_WIDTH, {
        duration: CLOUD_DURATION_MS,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(cloudTranslateX);
    };
  }, [cloudTranslateX, windowWidth]);

  const riderAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: riderTranslateY.value }],
  }));

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const cloudAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cloudTranslateX.value }],
  }));

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withSpring(scale.value) }],
    };
  });

  const getEmailError = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return 'Email is required';
    if (!validateEmail(trimmed)) return 'Enter a valid email address';
    return null;
  };

  const getPasswordError = (value: string): string | null => {
    if (!value) return 'Password is required';
    return null;
  };

  const handleLogin = async () => {
    const nextEmailError = getEmailError(email);
    const nextPasswordError = getPasswordError(password);
    setTouched({ email: true, password: true });
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (nextEmailError || nextPasswordError) {
      setFormError(null);
      return;
    }

    setFormError(null);
    setIsLoading(true);

    try {
      await signIn(email, password);
      // Navigation will be handled automatically by the auth state change in index.tsx
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = 'Failed to sign in';

      if (error.message) {
        errorMessage = error.message;
      } else if (
        error.includes &&
        error.includes('Invalid login credentials')
      ) {
        errorMessage =
          'Invalid email or password. Please check your credentials and try again.';
      } else if (error.includes && error.includes('Email not confirmed')) {
        errorMessage = 'Please confirm your email address before signing in.';
      }

      if (isEmailUnconfirmedError(errorMessage)) {
        showUnconfirmedEmailAlert();
      } else {
        setFormError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (isResending) return;
    setIsResending(true);
    try {
      await resendSignupConfirmation(email);
      showToast('Check your inbox for a new confirmation link.');
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Try again in a minute.',
        'error',
      );
    } finally {
      setIsResending(false);
    }
  };

  const showUnconfirmedEmailAlert = () => {
    showAlert(
      'Confirm your email',
      'Your account is waiting on the confirmation link we sent. Open your inbox, or resend the email if you cannot find it.',
      [
        {
          text: 'Open email app',
          onPress: () => {
            void openEmailApp();
          },
        },
        {
          text: isResending ? 'Sending…' : 'Resend confirmation',
          onPress: () => {
            void handleResendConfirmation();
          },
        },
      ],
    );
  };

  const enabledProviders = getEnabledOAuthProviders();

  const [isSocialLoading, setIsSocialLoading] = useState(false);

  const handleSocialLogin = async (provider: OAuthProvider) => {
    setIsSocialLoading(true);
    try {
      const result = await startOAuth(provider);
      if (result === 'cancel') {
        return;
      }
      router.replace('/');
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : 'Social login could not be started. Check provider setup in Supabase.';
      setFormError(msg);
    } finally {
      setIsSocialLoading(false);
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        >
          <View
            style={[
              styles.hero,
              {
                height: heroHeight + insets.top,
                backgroundColor: heroBackground,
              },
            ]}
          >
            <View style={[styles.heroTop, { paddingTop: 8 + insets.top }]}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <ArrowLeft size={24} color={heroForeground} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <Animated.Image
              source={loginCloud}
              resizeMode="contain"
              pointerEvents="none"
              style={[styles.heroCloud, cloudAnimStyle]}
            />
            <Animated.Image
              source={loginRider}
              resizeMode="contain"
              style={[styles.heroRider, riderAnimStyle]}
            />
          </View>

          <Animated.View
            style={[
              styles.sheet,
              sheetAnimStyle,
              { paddingBottom: insets.bottom },
            ]}
          >
            <View
              pointerEvents="none"
              style={[
                styles.sheetBackground,
                { backgroundColor: theme.colors.background },
              ]}
            />
            <View style={styles.content}>
              <View style={styles.logoSection}>
                <Text style={[styles.title, { color: theme.colors.text }]}>
                  Welcome Back
                </Text>
                <Text
                  style={[
                    styles.subtitle,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Sign in to your Ridely account
                </Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text
                    style={[styles.inputLabel, { color: theme.colors.text }]}
                  >
                    Email Address
                  </Text>
                  <View
                    style={[
                      styles.inputContainer,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: emailError
                          ? theme.colors.error
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <Mail
                      size={20}
                      color={
                        emailError
                          ? theme.colors.error
                          : theme.colors.textSecondary
                      }
                      strokeWidth={2}
                    />
                    <TextInput
                      style={[styles.input, { color: theme.colors.text }]}
                      placeholder="Enter your email"
                      placeholderTextColor={theme.colors.textTertiary}
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        setFormError(null);
                        if (touched.email) {
                          setEmailError(getEmailError(t));
                        }
                      }}
                      onBlur={() => {
                        setTouched((prev) => ({ ...prev, email: true }));
                        setEmailError(getEmailError(email));
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                    />
                  </View>
                  <FormError message={emailError} />
                </View>

                <View style={styles.inputGroup}>
                  <Text
                    style={[styles.inputLabel, { color: theme.colors.text }]}
                  >
                    Password
                  </Text>
                  <View
                    style={[
                      styles.inputContainer,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: passwordError
                          ? theme.colors.error
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <Lock
                      size={20}
                      color={
                        passwordError
                          ? theme.colors.error
                          : theme.colors.textSecondary
                      }
                      strokeWidth={2}
                    />
                    <TextInput
                      style={[
                        styles.passwordInput,
                        { color: theme.colors.text },
                      ]}
                      placeholder="Enter your password"
                      placeholderTextColor={theme.colors.textTertiary}
                      value={password}
                      onChangeText={(t) => {
                        setPassword(t);
                        setFormError(null);
                        if (touched.password) {
                          setPasswordError(getPasswordError(t));
                        }
                      }}
                      onBlur={() => {
                        setTouched((prev) => ({ ...prev, password: true }));
                        setPasswordError(getPasswordError(password));
                      }}
                      secureTextEntry={!showPassword}
                      autoComplete="password"
                      textContentType="password"
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
                  <FormError message={passwordError} />
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

                <FormError message={formError} />

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
                      isLoading && {
                        backgroundColor: theme.colors.textTertiary,
                      },
                      animatedStyle,
                    ]}
                  >
                    <Text style={styles.loginButtonText}>
                      {isLoading ? 'Signing In...' : 'Sign In'}
                    </Text>
                  </Animated.View>
                </Pressable>
              </View>

              {enabledProviders.length > 0 ? (
                <>
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
                </>
              ) : null}
            </View>

            {/* Sign up prompt – below form, scrolls with content so it stays visible above keyboard */}
            <View style={styles.bottomContainer}>
              <TouchableOpacity
                onPress={() => router.push('/(auth)/signup')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.signupText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Don't have an account?{' '}
                  <Text
                    style={[styles.signupLink, { color: theme.colors.primary }]}
                  >
                    Sign Up
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    zIndex: 2,
  },
  heroCloud: {
    position: 'absolute',
    top: 56,
    left: 0,
    width: CLOUD_WIDTH,
    height: 72,
    zIndex: 0,
  },
  heroRider: {
    position: 'absolute',
    right: -12,
    bottom: -18,
    width: 240,
    height: 260,
    zIndex: 1,
  },
  sheet: {
    flexGrow: 1,
    marginTop: -48,
    zIndex: 2,
  },
  sheetBackground: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
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
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingBottom: 8,
  },
  socialButton: {
    minWidth: 44,
    minHeight: 44,
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

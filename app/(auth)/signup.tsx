import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Package,
  ShoppingBag,
  Bike,
  CheckCircle,
  AlertCircle,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { useLogo } from '@/hooks/useLogo';
import {
  validateEmail,
  validatePhone,
  formatPhoneNumber,
  getPasswordStrength,
} from '@/utils/validation';
import { GoogleLogo, FacebookLogo, AppleLogo } from '@/lib/SocialIcons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import {
  getEnabledOAuthProviders,
  OAuthProvider,
  startOAuth,
} from '@/lib/socialAuth';
import { openEmailApp } from '@/lib/emailInbox';

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { logo } = useLogo();
  const { signUp } = useAuth();
  const { showAlert } = useAlert();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [userType, setUserType] = useState<'user' | 'rider'>('user');
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const passwordStrength = getPasswordStrength(formData.password);
  const enabledProviders = getEnabledOAuthProviders();

  const handleSocialSignup = async (provider: OAuthProvider) => {
    setIsLoading(true);
    try {
      const result = await startOAuth(provider, { userType });
      if (result === 'cancel') {
        return;
      }
      router.replace('/');
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : 'Social signup could not be started. Check provider setup in Supabase.';
      setValidationErrors((prev) => ({ ...prev, form: msg }));
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      errors.fullName = 'Full name is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!validatePhone(formData.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    } else if (passwordStrength.strength === 'weak') {
      errors.password = 'Password is too weak';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (!acceptTerms) {
      errors.terms = 'Please accept the terms and conditions';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp(
        formData.email,
        formData.password,
        {
          fullName: formData.fullName,
          phone: formData.phone,
        },
        userType,
      );

      if (!result.needsEmailConfirmation) {
        router.replace('/');
        return;
      }

      const goToLogin = () =>
        router.replace({
          pathname: '/(auth)/login',
          params: { email: formData.email.trim() },
        });

      showAlert(
        'Check your email',
        `We sent a confirmation link to ${formData.email.trim()}. Open your inbox, tap the link, then come back to sign in.`,
        [
          {
            text: 'Open email app',
            onPress: () => {
              void openEmailApp();
              goToLogin();
            },
          },
          {
            text: 'Go to Sign In',
            onPress: goToLogin,
          },
        ],
      );
    } catch (error: any) {
      console.error('Signup error:', error);

      // Handle specific error messages
      if (error.message) {
        if (error.message.includes('ACCOUNT_EXISTS')) {
          // User already has an account - show friendly message
          showAlert(
            'Account Already Exists',
            'An account with this email already exists. Please sign in instead.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Go to Sign In',
                onPress: () => router.replace('/(auth)/login'),
              },
            ],
          );
        } else if (error.message.includes('EMAIL_CONFIRMATION_REQUIRED')) {
          const goToLogin = () =>
            router.replace({
              pathname: '/(auth)/login',
              params: { email: formData.email.trim() },
            });
          showAlert(
            'Check your email',
            `We sent a confirmation link to ${formData.email.trim()}. Open your inbox, tap the link, then come back to sign in.`,
            [
              {
                text: 'Open email app',
                onPress: () => {
                  void openEmailApp();
                  goToLogin();
                },
              },
              {
                text: 'Go to Sign In',
                onPress: goToLogin,
              },
            ],
          );
        } else {
          setValidationErrors((prev) => ({
            ...prev,
            form: error.message || 'An unexpected error occurred. Please try again.',
          }));
          setTouchedFields((prev) => new Set(prev).add('form'));
        }
      } else {
        setValidationErrors((prev) => ({
          ...prev,
          form: 'An unexpected error occurred. Please try again.',
        }));
        setTouchedFields((prev) => new Set(prev).add('form'));
      }

      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (key: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === 'phone') {
        updated[key] = formatPhoneNumber(value);
      }
      return updated;
    });

    setTouchedFields((prev) => new Set(prev).add(key));

    if (validationErrors[key]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const getFieldError = (field: string): string | null => {
    if (field === 'form') return validationErrors.form || null;
    if (!touchedFields.has(field)) return null;
    return validationErrors[field] || null;
  };

  // Animated scale for button
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withSpring(scale.value) }],
    };
  });

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
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
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              {/* Logo */}
              <View style={styles.logoSection}>
                <Image source={logo} style={styles.logoImage} />
                <Text style={[styles.title, { color: theme.colors.text }]}>
                  Create Account
                </Text>
                <Text
                  style={[
                    styles.subtitle,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Sign up to get started with Ridely
                </Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                {/* User Type Selection */}
                <View style={styles.inputGroup}>
                  <Text
                    style={[styles.inputLabel, { color: theme.colors.text }]}
                  >
                    I want to
                  </Text>
                  <View style={styles.userTypeContainer}>
                    <TouchableOpacity
                      style={[
                        styles.userTypeCard,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.border,
                        },
                        userType === 'user' && {
                          backgroundColor: `${theme.colors.primary}15`,
                          borderColor: theme.colors.primary,
                          borderWidth: 2,
                        },
                      ]}
                      onPress={() => setUserType('user')}
                    >
                      <View
                        style={[
                          styles.userTypeIcon,
                          {
                            backgroundColor:
                              userType === 'user'
                                ? theme.colors.primary
                                : theme.colors.border,
                          },
                        ]}
                      >
                        <ShoppingBag
                          size={24}
                          color={
                            userType === 'user'
                              ? '#FFFFFF'
                              : theme.colors.textSecondary
                          }
                          strokeWidth={2}
                        />
                      </View>
                      <Text
                        style={[
                          styles.userTypeTitle,
                          {
                            color:
                              userType === 'user'
                                ? theme.colors.primary
                                : theme.colors.text,
                          },
                        ]}
                      >
                        Send Packages
                      </Text>
                      <Text
                        style={[
                          styles.userTypeDescription,
                          { color: theme.colors.textSecondary },
                        ]}
                      >
                        Book deliveries
                      </Text>
                      {userType === 'user' && (
                        <View style={styles.selectedBadge}>
                          <CheckCircle size={16} color={theme.colors.primary} />
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.userTypeCard,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.border,
                        },
                        userType === 'rider' && {
                          backgroundColor: `${theme.colors.primary}15`,
                          borderColor: theme.colors.primary,
                          borderWidth: 2,
                        },
                      ]}
                      onPress={() => setUserType('rider')}
                    >
                      <View
                        style={[
                          styles.userTypeIcon,
                          {
                            backgroundColor:
                              userType === 'rider'
                                ? theme.colors.primary
                                : theme.colors.border,
                          },
                        ]}
                      >
                        <Bike
                          size={24}
                          color={
                            userType === 'rider'
                              ? '#FFFFFF'
                              : theme.colors.textSecondary
                          }
                          strokeWidth={2}
                        />
                      </View>
                      <Text
                        style={[
                          styles.userTypeTitle,
                          {
                            color:
                              userType === 'rider'
                                ? theme.colors.primary
                                : theme.colors.text,
                          },
                        ]}
                      >
                        Deliver Packages
                      </Text>
                      <Text
                        style={[
                          styles.userTypeDescription,
                          { color: theme.colors.textSecondary },
                        ]}
                      >
                        Earn as a rider
                      </Text>
                      {userType === 'rider' && (
                        <View style={styles.selectedBadge}>
                          <CheckCircle size={16} color={theme.colors.primary} />
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text
                    style={[styles.inputLabel, { color: theme.colors.text }]}
                  >
                    Full Name
                  </Text>
                  <View
                    style={[
                      styles.inputContainer,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: getFieldError('fullName')
                          ? theme.colors.error
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <User
                      size={20}
                      color={
                        getFieldError('fullName')
                          ? theme.colors.error
                          : theme.colors.textSecondary
                      }
                      strokeWidth={2}
                    />
                    <TextInput
                      style={[styles.input, { color: theme.colors.text }]}
                      placeholder="Enter your full name"
                      placeholderTextColor={theme.colors.textTertiary}
                      value={formData.fullName}
                      onChangeText={(text) => updateFormData('fullName', text)}
                      onBlur={() =>
                        setTouchedFields((prev) =>
                          new Set(prev).add('fullName'),
                        )
                      }
                    />
                  </View>
                  {getFieldError('fullName') && (
                    <Animated.View
                      entering={FadeInDown}
                      style={styles.errorContainer}
                    >
                      <AlertCircle size={14} color={theme.colors.error} />
                      <Text
                        style={[
                          styles.errorText,
                          { color: theme.colors.error },
                        ]}
                      >
                        {getFieldError('fullName')}
                      </Text>
                    </Animated.View>
                  )}
                </View>

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
                        borderColor: getFieldError('email')
                          ? theme.colors.error
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <Mail
                      size={20}
                      color={
                        getFieldError('email')
                          ? theme.colors.error
                          : theme.colors.textSecondary
                      }
                      strokeWidth={2}
                    />
                    <TextInput
                      style={[styles.input, { color: theme.colors.text }]}
                      placeholder="Enter your email"
                      placeholderTextColor={theme.colors.textTertiary}
                      value={formData.email}
                      onChangeText={(text) => updateFormData('email', text)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onBlur={() =>
                        setTouchedFields((prev) => new Set(prev).add('email'))
                      }
                    />
                    {formData.email &&
                      !getFieldError('email') &&
                      validateEmail(formData.email) && (
                        <CheckCircle size={18} color={theme.colors.success} />
                      )}
                  </View>
                  {getFieldError('email') && (
                    <Animated.View
                      entering={FadeInDown}
                      style={styles.errorContainer}
                    >
                      <AlertCircle size={14} color={theme.colors.error} />
                      <Text
                        style={[
                          styles.errorText,
                          { color: theme.colors.error },
                        ]}
                      >
                        {getFieldError('email')}
                      </Text>
                    </Animated.View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text
                    style={[styles.inputLabel, { color: theme.colors.text }]}
                  >
                    Phone Number
                  </Text>
                  <View
                    style={[
                      styles.inputContainer,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: getFieldError('phone')
                          ? theme.colors.error
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <Phone
                      size={20}
                      color={
                        getFieldError('phone')
                          ? theme.colors.error
                          : theme.colors.textSecondary
                      }
                      strokeWidth={2}
                    />
                    <TextInput
                      style={[styles.input, { color: theme.colors.text }]}
                      placeholder="080 123 4567"
                      placeholderTextColor={theme.colors.textTertiary}
                      value={formData.phone}
                      onChangeText={(text) => updateFormData('phone', text)}
                      keyboardType="phone-pad"
                      maxLength={15}
                      onBlur={() =>
                        setTouchedFields((prev) => new Set(prev).add('phone'))
                      }
                    />
                    {formData.phone &&
                      !getFieldError('phone') &&
                      validatePhone(formData.phone) && (
                        <CheckCircle size={18} color={theme.colors.success} />
                      )}
                  </View>
                  {getFieldError('phone') && (
                    <Animated.View
                      entering={FadeInDown}
                      style={styles.errorContainer}
                    >
                      <AlertCircle size={14} color={theme.colors.error} />
                      <Text
                        style={[
                          styles.errorText,
                          { color: theme.colors.error },
                        ]}
                      >
                        {getFieldError('phone')}
                      </Text>
                    </Animated.View>
                  )}
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
                        borderColor: getFieldError('password')
                          ? theme.colors.error
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <Lock
                      size={20}
                      color={
                        getFieldError('password')
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
                      placeholder="Create a password"
                      placeholderTextColor={theme.colors.textTertiary}
                      value={formData.password}
                      onChangeText={(text) => updateFormData('password', text)}
                      secureTextEntry={!showPassword}
                      onBlur={() =>
                        setTouchedFields((prev) =>
                          new Set(prev).add('password'),
                        )
                      }
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
                  {formData.password && (
                    <View style={styles.passwordStrengthContainer}>
                      <View style={styles.passwordStrengthBar}>
                        {[1, 2, 3, 4].map((i) => (
                          <View
                            key={i}
                            style={[
                              styles.passwordStrengthSegment,
                              {
                                backgroundColor:
                                  passwordStrength.score >= i
                                    ? passwordStrength.strength === 'weak'
                                      ? theme.colors.error
                                      : passwordStrength.strength === 'fair'
                                        ? theme.colors.warning
                                        : theme.colors.success
                                    : theme.colors.border,
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <Text
                        style={[
                          styles.passwordStrengthText,
                          {
                            color:
                              passwordStrength.strength === 'weak'
                                ? theme.colors.error
                                : passwordStrength.strength === 'fair'
                                  ? theme.colors.warning
                                  : theme.colors.success,
                          },
                        ]}
                      >
                        {passwordStrength.strength.charAt(0).toUpperCase() +
                          passwordStrength.strength.slice(1)}
                      </Text>
                    </View>
                  )}
                  {getFieldError('password') && (
                    <Animated.View
                      entering={FadeInDown}
                      style={styles.errorContainer}
                    >
                      <AlertCircle size={14} color={theme.colors.error} />
                      <Text
                        style={[
                          styles.errorText,
                          { color: theme.colors.error },
                        ]}
                      >
                        {getFieldError('password')}
                      </Text>
                    </Animated.View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text
                    style={[styles.inputLabel, { color: theme.colors.text }]}
                  >
                    Confirm Password
                  </Text>
                  <View
                    style={[
                      styles.inputContainer,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: getFieldError('confirmPassword')
                          ? theme.colors.error
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <Lock
                      size={20}
                      color={
                        getFieldError('confirmPassword')
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
                      placeholder="Confirm your password"
                      placeholderTextColor={theme.colors.textTertiary}
                      value={formData.confirmPassword}
                      onChangeText={(text) =>
                        updateFormData('confirmPassword', text)
                      }
                      secureTextEntry={!showConfirmPassword}
                      onBlur={() =>
                        setTouchedFields((prev) =>
                          new Set(prev).add('confirmPassword'),
                        )
                      }
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                    >
                      {showConfirmPassword ? (
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
                    {formData.confirmPassword &&
                      !getFieldError('confirmPassword') &&
                      formData.password === formData.confirmPassword && (
                        <CheckCircle size={18} color={theme.colors.success} />
                      )}
                  </View>
                  {getFieldError('confirmPassword') && (
                    <Animated.View
                      entering={FadeInDown}
                      style={styles.errorContainer}
                    >
                      <AlertCircle size={14} color={theme.colors.error} />
                      <Text
                        style={[
                          styles.errorText,
                          { color: theme.colors.error },
                        ]}
                      >
                        {getFieldError('confirmPassword')}
                      </Text>
                    </Animated.View>
                  )}
                </View>

                {/* Terms and Conditions */}
                <View style={styles.termsSection}>
                  <TouchableOpacity
                    style={styles.termsContainer}
                    onPress={() => setAcceptTerms(!acceptTerms)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: theme.colors.border },
                        acceptTerms && {
                          backgroundColor: theme.colors.primary,
                          borderColor: theme.colors.primary,
                        },
                        getFieldError('terms') && {
                          borderColor: theme.colors.error,
                        },
                      ]}
                    >
                      {acceptTerms && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text
                      style={[
                        styles.termsText,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      I agree to the{' '}
                      <Text
                        style={[
                          styles.termsLink,
                          { color: theme.colors.primary },
                        ]}
                        onPress={() => router.push('/terms-of-service')}
                      >
                        Terms of Service
                      </Text>{' '}
                      and{' '}
                      <Text
                        style={[
                          styles.termsLink,
                          { color: theme.colors.primary },
                        ]}
                        onPress={() => router.push('/privacy-policy')}
                      >
                        Privacy Policy
                      </Text>
                    </Text>
                  </TouchableOpacity>
                  {getFieldError('terms') && (
                    <Animated.View
                      entering={FadeInDown}
                      style={styles.errorContainer}
                    >
                      <AlertCircle size={14} color={theme.colors.error} />
                      <Text
                        style={[
                          styles.errorText,
                          { color: theme.colors.error },
                        ]}
                      >
                        {getFieldError('terms')}
                      </Text>
                    </Animated.View>
                  )}
                </View>

                {getFieldError('form') ? (
                  <Animated.View entering={FadeInDown} style={styles.errorContainer}>
                    <AlertCircle size={14} color={theme.colors.error} />
                    <Text style={[styles.errorText, { color: theme.colors.error }]}>
                      {getFieldError('form')}
                    </Text>
                  </Animated.View>
                ) : null}

                <Pressable
                  onPressIn={() => (scale.value = 0.95)}
                  onPressOut={() => (scale.value = 1)}
                  onPress={handleSignup}
                  disabled={isLoading}
                >
                  <Animated.View
                    style={[
                      styles.signupButton,
                      { backgroundColor: theme.colors.primary },
                      isLoading && {
                        backgroundColor: theme.colors.textTertiary,
                      },
                      animatedStyle,
                    ]}
                  >
                    <Text style={styles.signupButtonText}>
                      {isLoading ? 'Creating Account...' : 'Create Account'}
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
                      Or sign up with
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
                        onPress={() => handleSocialSignup('google')}
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
                        onPress={() => handleSocialSignup('facebook')}
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
                        onPress={() => handleSocialSignup('apple')}
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
          </ScrollView>

          {/* Bottom */}
          <View style={styles.bottomContainer}>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginText}>
                Already have an account?{' '}
                <Text
                  style={[styles.loginLink, { color: theme.colors.primary }]}
                >
                  Sign In
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  keyboardAvoidingView: {
    flex: 1,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
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
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
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
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  termsLink: {
    fontWeight: '500',
  },
  signupButton: {
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
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
    marginBottom: 32,
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
    marginBottom: 14,
    fontSize: 13,
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#6B7280', // Keep neutral for readability
  },
  loginLink: {
    fontWeight: '600',
  },
  userTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  userTypeCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  userTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  userTypeTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  userTypeDescription: {
    fontSize: 13,
    textAlign: 'center',
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  errorText: {
    fontSize: 13,
  },
  passwordStrengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  passwordStrengthBar: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    height: 4,
  },
  passwordStrengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 50,
  },
  termsSection: {
    marginBottom: 24,
  },
});

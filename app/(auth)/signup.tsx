import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Package,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useLogo } from '@/hooks/useLogo';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

export default function SignupScreen() {
  const { theme } = useTheme();
  const { logo } = useLogo();
  const { signUp } = useAuth();
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

  const handleSignup = async () => {
    // Validation
    if (
      !formData.fullName ||
      !formData.email ||
      !formData.phone ||
      !formData.password
    ) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!formData.email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!acceptTerms) {
      Alert.alert('Error', 'Please accept the terms and conditions');
      return;
    }

    setIsLoading(true);

    try {
      await signUp(
        formData.email,
        formData.password,
        {
          fullName: formData.fullName,
          phone: formData.phone,
        },
        userType
      );
      
      // If we get here, the signup was successful
      Alert.alert(
        'Account Created!',
        'Your account has been created successfully. You can now sign in.',
        [
          {
            text: 'Sign In',
            onPress: () => router.replace('/(auth)/login'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Handle specific error messages
      if (error.message) {
        if (error.message.includes('already registered') || 
            error.message.includes('already exists') ||
            error.message.includes('User already registered')) {
          Alert.alert(
            'Account Exists',
            'An account with this email already exists. Please try signing in instead.',
            [
              {
                text: 'OK',
                style: 'cancel'
              },
              {
                text: 'Go to Sign In',
                onPress: () => router.replace('/(auth)/login')
              }
            ]
          );
        } else {
          Alert.alert('Signup Failed', error.message);
        }
      } else {
        Alert.alert('Signup Failed', 'An unexpected error occurred. Please try again.');
      }
      
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
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
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
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
                style={[styles.subtitle, { color: theme.colors.textSecondary }]}
              >
                Sign up to get started with Ridely
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* User Type Selection */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                  Account Type
                </Text>
                <View style={styles.userTypeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.userTypeButton,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                      },
                      userType === 'user' && {
                        backgroundColor: theme.colors.primary,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                    onPress={() => setUserType('user')}
                  >
                    <Text
                      style={[
                        styles.userTypeText,
                        {
                          color:
                            userType === 'user' ? '#FFFFFF' : theme.colors.text,
                        },
                      ]}
                    >
                      Customer
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.userTypeButton,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                      },
                      userType === 'rider' && {
                        backgroundColor: theme.colors.primary,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                    onPress={() => setUserType('rider')}
                  >
                    <Text
                      style={[
                        styles.userTypeText,
                        {
                          color:
                            userType === 'rider'
                              ? '#FFFFFF'
                              : theme.colors.text,
                        },
                      ]}
                    >
                      Rider
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                  Full Name
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
                  <User
                    size={20}
                    color={theme.colors.textSecondary}
                    strokeWidth={2}
                  />
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder="Enter your full name"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={formData.fullName}
                    onChangeText={(text) => updateFormData('fullName', text)}
                  />
                </View>
              </View>

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
                    value={formData.email}
                    onChangeText={(text) => updateFormData('email', text)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                  Phone Number
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
                  <Phone
                    size={20}
                    color={theme.colors.textSecondary}
                    strokeWidth={2}
                  />
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder="Enter your phone number"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={formData.phone}
                    onChangeText={(text) => updateFormData('phone', text)}
                    keyboardType="phone-pad"
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
                    placeholder="Create a password"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={formData.password}
                    onChangeText={(text) => updateFormData('password', text)}
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

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                  Confirm Password
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
                    placeholder="Confirm your password"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={formData.confirmPassword}
                    onChangeText={(text) =>
                      updateFormData('confirmPassword', text)
                    }
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
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
                </View>
              </View>

              {/* Terms and Conditions */}
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
                    style={[styles.termsLink, { color: theme.colors.primary }]}
                  >
                    Terms of Service
                  </Text>{' '}
                  and{' '}
                  <Text
                    style={[styles.termsLink, { color: theme.colors.primary }]}
                  >
                    Privacy Policy
                  </Text>
                </Text>
              </TouchableOpacity>

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
                    isLoading && { backgroundColor: theme.colors.textTertiary },
                    animatedStyle,
                  ]}
                >
                  <Text style={styles.signupButtonText}>
                    {isLoading ? 'Creating Account...' : 'Create Account'}
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
                Or sign up with
              </Text>
              <View
                style={[
                  styles.dividerLine,
                  { backgroundColor: theme.colors.border },
                ]}
              />
            </View>

            {/* Social Signup */}
            <View style={styles.socialContainer}>
              <TouchableOpacity
                style={[
                  styles.socialButton,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={styles.socialButtonText}>G</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.socialButton,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={styles.socialButtonText}>f</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.socialButton,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={styles.socialButtonText}>🍎</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Bottom */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginText}>
              Already have an account?{' '}
              <Text style={[styles.loginLink, { color: theme.colors.primary }]}>
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    width: 80,
    height: 80,
    resizeMode: 'contain',
    marginBottom: 12,
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
    gap: 16,
    marginBottom: 32,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  socialButtonText: {
    fontSize: 20,
    fontWeight: '600',
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
  userTypeButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  userTypeText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

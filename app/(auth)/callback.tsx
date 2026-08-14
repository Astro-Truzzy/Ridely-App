import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { CheckCircle, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { createSessionFromRedirectUrl } from '@/lib/socialAuth';

export default function AuthCallbackScreen() {
  const { theme } = useTheme();
  const { session, userType, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('Confirming your email...');

  useEffect(() => {
    if (status !== 'success') return;

    const goHome = () => {
      router.replace(userType === 'rider' ? '/(rider)/dashboard' : '/(tabs)');
    };

    if (!authLoading && session) {
      const timer = setTimeout(goHome, 1200);
      return () => clearTimeout(timer);
    }

    const fallback = setTimeout(goHome, 4000);
    return () => clearTimeout(fallback);
  }, [status, session, userType, authLoading]);

  useEffect(() => {
    let active = true;

    const complete = async (url: string) => {
      try {
        await createSessionFromRedirectUrl(url);
        if (!active) return;
        setStatus('success');
        setMessage('Your email is confirmed. Taking you home…');
      } catch (e) {
        if (!active) return;
        setStatus('error');
        setMessage(
          e instanceof Error
            ? e.message
            : 'This confirmation link is invalid or has expired.',
        );
      }
    };

    const bootstrap = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (
        initialUrl &&
        (initialUrl.includes('callback') ||
          initialUrl.includes('access_token') ||
          initialUrl.includes('code='))
      ) {
        await complete(initialUrl);
        return;
      }
      if (active) {
        setStatus('error');
        setMessage('Open the confirmation link from your email to continue.');
      }
    };

    const sub = Linking.addEventListener('url', ({ url }) => {
      if (!url) return;
      setStatus('loading');
      setMessage('Confirming your email...');
      complete(url);
    });

    bootstrap();
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  const title =
    status === 'success'
      ? "You're in"
      : status === 'error'
        ? 'Could not confirm email'
        : 'Confirming your email';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {status === 'loading' ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : null}
        {status === 'success' ? (
          <CheckCircle size={52} color={theme.colors.primary} strokeWidth={2} />
        ) : null}
        {status === 'error' ? (
          <AlertCircle size={52} color={theme.colors.error} strokeWidth={2} />
        ) : null}
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
          {message}
        </Text>
        {status === 'error' ? (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.buttonText}>Go to Sign In</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
  },
  title: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '700',
  },
  message: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { completeOAuthFromDeepLink, getOAuthRedirectUri } from '@/lib/socialAuth';

export default function OAuthCallbackScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [message, setMessage] = useState('Completing sign-in...');

  useEffect(() => {
    const run = async () => {
      if (params.error) {
        setStatus('error');
        setMessage(String(params.error_description || params.error));
        return;
      }

      try {
        const query = new URLSearchParams();
        if (typeof params.code === 'string') query.set('code', params.code);
        const queryString = query.toString();
        const callbackBase = getOAuthRedirectUri().split('?')[0];
        const callbackUrl = queryString ? `${callbackBase}?${queryString}` : '';

        if (!callbackUrl) {
          setStatus('error');
          setMessage('No OAuth code received. Please try again.');
          return;
        }

        await completeOAuthFromDeepLink(callbackUrl);
        router.replace('/');
      } catch (e) {
        setStatus('error');
        setMessage(e instanceof Error ? e.message : 'Failed to complete social sign-in.');
      }
    };

    run();
  }, [params.code, params.error, params.error_description]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {status === 'loading' ? (
          <>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.title, { color: theme.colors.text }]}>Signing you in</Text>
            <Text style={[styles.message, { color: theme.colors.textSecondary }]}>{message}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: theme.colors.text }]}>Social sign-in failed</Text>
            <Text style={[styles.message, { color: theme.colors.textSecondary }]}>{message}</Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.primary }]}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.buttonText}>Back to Login</Text>
            </TouchableOpacity>
          </>
        )}
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
    padding: 24,
    alignItems: 'center',
  },
  title: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '700',
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

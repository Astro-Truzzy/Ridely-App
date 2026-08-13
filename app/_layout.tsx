import '@/lib/livekitSetup';
import { initSentry, Sentry } from '@/lib/sentry';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { queryClient } from '@/lib/queryClient';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { AlertProvider } from '@/contexts/AlertContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { VoiceCallProvider } from '@/contexts/VoiceCallContext';
import { PushRegistration } from '@/components/PushRegistration';
import { ErrorBoundary } from '@/components/ErrorBoundary';

initSentry();
WebBrowser.maybeCompleteAuthSession();

function RootLayout() {
  useFrameworkReady();

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AlertProvider>
              <AuthProvider>
                <VoiceCallProvider>
                  <NotificationsProvider>
                    <PushRegistration />
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="(auth)" />
                      <Stack.Screen name="(rider)" />
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen name="profile" />
                      <Stack.Screen name="booking" />
                      <Stack.Screen name="track/[token]" />
                      <Stack.Screen name="tracking" />
                      <Stack.Screen name="chat" />
                      <Stack.Screen name="language" />
                      <Stack.Screen name="privacy-policy" />
                      <Stack.Screen name="terms-of-service" />
                      <Stack.Screen name="notification-schedule" />
                      <Stack.Screen name="+not-found" />
                    </Stack>
                    <StatusBar style="auto" />
                  </NotificationsProvider>
                </VoiceCallProvider>
              </AuthProvider>
            </AlertProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);

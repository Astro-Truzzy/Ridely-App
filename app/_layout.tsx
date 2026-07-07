import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { AlertProvider } from '@/contexts/AlertContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { PushRegistration } from '@/components/PushRegistration';

WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  useFrameworkReady();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AlertProvider>
          <AuthProvider>
            <NotificationsProvider>
            <PushRegistration />
            <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(rider)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="favorites" />
            <Stack.Screen name="booking" />
            <Stack.Screen name="language" />
            <Stack.Screen name="privacy-policy" />
            <Stack.Screen name="terms-of-service" />
            <Stack.Screen name="notification-schedule" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
            </NotificationsProvider>
          </AuthProvider>
        </AlertProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
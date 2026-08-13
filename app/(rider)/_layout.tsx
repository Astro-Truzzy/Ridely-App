import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AppSettingsProvider } from '@/contexts/AppSettingsContext';

export default function RiderLayout() {
  const { session, userType, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/(auth)/loading');
      return;
    }
    if (userType === 'user') {
      router.replace('/(tabs)');
    }
  }, [session, userType, loading]);

  return (
    <LanguageProvider>
    <AppSettingsProvider>
    <Stack screenOptions={{ headerShown: false }} initialRouteName="dashboard">
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="job-details" />
      <Stack.Screen name="active-delivery" />
      <Stack.Screen name="earnings" />
      <Stack.Screen name="payout" />
      <Stack.Screen name="withdrawal-pin" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="vehicle-information" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="support" />
      <Stack.Screen name="language" />
      <Stack.Screen name="notification-schedule" />
      <Stack.Screen name="privacy-policy" />
      <Stack.Screen name="terms-of-service" />
      <Stack.Screen name="apply-verification" />
    </Stack>
    </AppSettingsProvider>
    </LanguageProvider>
  );
}
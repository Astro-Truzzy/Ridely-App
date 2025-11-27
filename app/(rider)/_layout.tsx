import { Stack } from 'expo-router';

export default function RiderLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} initialRouteName="dashboard">
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="job-details" />
      <Stack.Screen name="active-delivery" />
      <Stack.Screen name="earnings" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="support" />
      <Stack.Screen name="language" />
      <Stack.Screen name="notification-schedule" />
      <Stack.Screen name="privacy-policy" />
      <Stack.Screen name="terms-of-service" />
    </Stack>
  );
}
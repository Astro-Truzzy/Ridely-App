import { Stack } from 'expo-router';

export default function BookingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="address" />
      <Stack.Screen name="pricing" />
      <Stack.Screen name="confirmation" />
    </Stack>
  );
}
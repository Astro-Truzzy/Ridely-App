import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="edit" />
      <Stack.Screen name="payment-methods" />
      <Stack.Screen name="add-payment" />
      <Stack.Screen name="add-card" />
      <Stack.Screen name="fund-wallet" />
      <Stack.Screen name="payment-webview" />
      <Stack.Screen name="saved-addresses" />
      <Stack.Screen name="add-saved-address" />
    </Stack>
  );
}

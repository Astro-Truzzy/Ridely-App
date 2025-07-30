import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect to loading screen first
  // In a real app, you'd check authentication state here
  return <Redirect href="/(auth)/loading" />;
}
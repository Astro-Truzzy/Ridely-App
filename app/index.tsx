import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function Index() {
  const { session, userType, loading } = useAuth();
  const { theme } = useTheme();

  if (loading) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background
      }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }
  
  if (!session) {
    return <Redirect href="/(auth)/loading" />;
  }

    if (userType === 'rider') {
      return <Redirect href="/(rider)/dashboard" />;
    }

    if (userType === 'user') {
      return <Redirect href="/(tabs)" />;
    }

    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background
      }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
}
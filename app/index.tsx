import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function Index() {
  const { session, userType, loading } = useAuth();
  const { theme } = useTheme();
  
  console.log('Index component - session:', session, 'userType:', userType, 'loading:', loading);
  
  if (loading) {
    console.log('Showing loading indicator');
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
    console.log('Redirecting to loading screen');
    return <Redirect href="/(auth)/loading" />;
  }

  if (userType === 'rider') {
    console.log('Redirecting to rider dashboard');
    return <Redirect href="/(rider)/dashboard" />;
  }

  if (userType === 'user') {
    console.log('Redirecting to tabs');
    return <Redirect href="/(tabs)" />;
  }
  
  console.log('Redirecting to tabs (default)');
  return <Redirect href="/(tabs)" />;
}
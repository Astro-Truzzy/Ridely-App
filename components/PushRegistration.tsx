import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';

/**
 * Registers for push notifications and saves the Expo push token to Supabase
 * when the user is logged in. Renders nothing. Place inside AuthProvider.
 */
export function PushRegistration() {
  const { user } = useAuth();
  usePushNotifications(user?.id);
  return null;
}

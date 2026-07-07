import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

// Show notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldAnimate: true,
  }),
});

export type PushNotificationData = {
  type?: string;
  deliveryId?: string;
  [key: string]: unknown;
};

export type NotificationResponseHandler = (data: PushNotificationData) => void;

let notificationResponseHandler: NotificationResponseHandler | null = null;

export function setNotificationResponseHandler(handler: NotificationResponseHandler | null) {
  notificationResponseHandler = handler;
}

/**
 * Registers for push notifications, returns Expo push token or null.
 * On physical device only; saves token to Supabase push_tokens.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#174AFF',
    });
    await Notifications.setNotificationChannelAsync('delivery_requests', {
      name: 'Delivery requests',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#174AFF',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { eas?: { projectId?: string } })?.eas?.projectId;
  if (!projectId) {
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Saves the Expo push token to Supabase for the current user.
 * Call after registering and when user logs in.
 */
export async function savePushTokenToSupabase(
  userId: string,
  expoPushToken: string
): Promise<boolean> {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  try {
    const { error } = await (supabase as any)
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          expo_push_token: expoPushToken,
          platform,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,expo_push_token' }
      );
    return !error;
  } catch {
    return false;
  }
}

/**
 * Registers for push, saves token to Supabase, and sets up listeners.
 * Use inside a component that has access to auth user.
 */
export function usePushNotifications(userId: string | undefined) {
  const listenerRef = useRef<{ subscription: Notifications.EventSubscription } | null>(null);
  const responseRef = useRef<{ subscription: Notifications.EventSubscription } | null>(null);

  useEffect(() => {
    if (!userId) return;

    let mounted = true;

    (async () => {
      const token = await registerForPushNotificationsAsync();
      if (!mounted || !token || !userId) return;
      await savePushTokenToSupabase(userId, token);
    })();

    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => {
      // In-app handling is done by NotificationsContext (realtime); push is for background/killed
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data || {}) as PushNotificationData;
      if (notificationResponseHandler) {
        notificationResponseHandler(data);
      }
    });

    listenerRef.current = { subscription: sub };
    responseRef.current = { subscription: responseSub };

    return () => {
      sub.remove();
      responseSub.remove();
    };
  }, []);
}

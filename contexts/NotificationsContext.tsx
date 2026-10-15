import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { DeliveryRequestModal } from '@/components/rider/DeliveryRequestModal';
import * as Notifications from 'expo-notifications';
import { setNotificationResponseHandler } from '@/hooks/usePushNotifications';
import {
  isJobActionableForRider,
  markJobRequestNotificationsRead,
} from '@/lib/riderJobAlerts';

const RIDER_SCHEDULE_KEY = '@ridely/rider_notification_schedule';
const USER_SCHEDULE_KEY = '@ridely/user_notification_schedule';
const HANDLED_PUSH_KEY = '@ridely/handled_push_identifiers';
// A tapped push older than this is treated as stale (e.g. the OS returning a
// days-old tap on every cold start) and must not pop a job modal.
const PUSH_RESPONSE_MAX_AGE_MS = 15 * 60 * 1000;

function isWithinQuietHours(startTime: string, endTime: string): boolean {
  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startM = sh * 60 + sm;
  const endM = eh * 60 + em;
  if (startM > endM) return minutesNow >= startM || minutesNow < endM;
  return minutesNow >= startM && minutesNow < endM;
}

interface NotificationsContextType {
  unreadCount: number;
  refetchUnreadCount: () => Promise<void>;
  decrementUnreadCount: (by?: number) => void;
  clearUnreadCount: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user, userType } = useAuth();
  const { showToast } = useAlert();
  const { receiptNotifications, pushNotifications } = useAppSettings();
  const [unreadCount, setUnreadCount] = useState(0);
  const [deliveryRequestModal, setDeliveryRequestModal] = useState<{ visible: boolean; deliveryId: string | null }>({
    visible: false,
    deliveryId: null,
  });
  const pendingDeliveryIdRef = useRef<string | null>(null);
  const isCustomer = userType === 'user';
  const isRider = userType === 'rider';
  const mountedRef = useRef(true);
  const riderId = isRider ? user?.id ?? null : null;

  /** Show the job modal only if the delivery is still open and not already dismissed. */
  const showJobRequestModal = useCallback(
    async (deliveryId: string, source: 'realtime' | 'push' | 'background') => {
      if (!riderId || !mountedRef.current) return;
      const actionable = await isJobActionableForRider(deliveryId, riderId);
      if (!mountedRef.current) return;
      if (!actionable) {
        // Dead or already-declined job: clear its notifications so it never
        // pops again instead of showing a phantom offer.
        await markJobRequestNotificationsRead(riderId, deliveryId);
        return;
      }
      if (source === 'background') {
        pendingDeliveryIdRef.current = deliveryId;
        if (AppState.currentState !== 'active') return;
      }
      if (mountedRef.current) {
        setDeliveryRequestModal({ visible: true, deliveryId });
        pendingDeliveryIdRef.current = null;
      }
    },
    [riderId]
  );

  const fetchUnreadCount = async () => {
    if (!user?.id) return;
    if (!isCustomer && !isRider) return;
    try {
      let query = (supabase as any)
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false);
      if (isCustomer) {
        query = query.eq('user_id', user.id).is('rider_id', null);
      } else {
        query = query.eq('rider_id', user.id);
      }
      if (!receiptNotifications) {
        query = query.neq('type', 'payment');
      }
      const { count, error } = await query;
      if (!error && mountedRef.current) setUnreadCount(count ?? 0);
    } catch {
      if (mountedRef.current) setUnreadCount(0);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    if (user?.id && (isCustomer || isRider)) {
      fetchUnreadCount();

      const channelName = isRider ? 'notifications-unread-rider' : 'notifications-unread';
      const insertFilter = isRider ? `rider_id=eq.${user.id}` : `user_id=eq.${user.id}`;
      const updateFilter = insertFilter;

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: insertFilter,
          },
          async (payload: { new: { id?: string; title?: string; message?: string; rider_id?: string | null; type?: string; delivery_id?: string | null } }) => {
            if (isCustomer && payload.new?.rider_id != null) return;
            const title = payload.new?.title ?? 'New notification';
            const message = payload.new?.message ?? '';
            const notifType = payload.new?.type;
            const deliveryId = payload.new?.delivery_id ?? null;
            if (notifType === 'payment' && !receiptNotifications) {
              return;
            }
            fetchUnreadCount();

            // Rider: delivery request → show custom modal with Accept/Reject (and optionally when app returns from background)
            if (isRider && notifType === 'job_request') {
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              } catch {}
              if (deliveryId && mountedRef.current) {
                const appState = AppState.currentState;
                await showJobRequestModal(
                  deliveryId,
                  appState === 'active' ? 'realtime' : 'background'
                );
                return;
              }
            }

            let showBanner = pushNotifications;
            if (isRider) {
              if (showBanner) {
                try {
                  const raw = await AsyncStorage.getItem(RIDER_SCHEDULE_KEY);
                  if (raw) {
                    const schedule = JSON.parse(raw) as { quietHoursEnabled?: boolean; startTime?: string; endTime?: string };
                    if (schedule.quietHoursEnabled && schedule.startTime && schedule.endTime && isWithinQuietHours(schedule.startTime, schedule.endTime)) {
                      showBanner = false;
                    }
                  }
                } catch {}
              }
            } else if (isCustomer) {
              if (showBanner && notifType !== 'delivery_update') {
                try {
                  const raw = await AsyncStorage.getItem(USER_SCHEDULE_KEY);
                  if (raw) {
                    const schedule = JSON.parse(raw) as { quietHoursEnabled?: boolean; startTime?: string; endTime?: string };
                    if (
                      schedule.quietHoursEnabled &&
                      schedule.startTime &&
                      schedule.endTime &&
                      isWithinQuietHours(schedule.startTime, schedule.endTime)
                    ) {
                      showBanner = false;
                    }
                  }
                } catch {}
              }
            }

            if (showBanner && mountedRef.current) {
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch {}
              showToast(message || title, notifType === 'payment' ? 'success' : 'info');
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: updateFilter,
          },
          () => {
            fetchUnreadCount();
          }
        )
        .subscribe();

      return () => {
        mountedRef.current = false;
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id, isCustomer, isRider, receiptNotifications, pushNotifications, showToast, showJobRequestModal]);

  // When app returns from background, show pending delivery request modal if we have one
  useEffect(() => {
    if (!isRider || !user?.id) return;
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && pendingDeliveryIdRef.current && mountedRef.current) {
        const id = pendingDeliveryIdRef.current;
        pendingDeliveryIdRef.current = null;
        // Revalidate: the job may have been taken or dismissed while backgrounded.
        void showJobRequestModal(id, 'realtime');
      }
    });
    return () => sub.remove();
  }, [isRider, user?.id, showJobRequestModal]);

  // Handle push notification tap (foreground/background) and app launched from notification (killed state)
  useEffect(() => {
    const isFreshPushResponse = (
      response: { notification?: { date?: number; request?: { identifier?: string } } } | null | undefined
    ): boolean => {
      const presentedAt = response?.notification?.date;
      // Unknown age: allow through (the modal revalidates before showing).
      // Known-old taps are stale OS replays and must be ignored.
      if (typeof presentedAt !== 'number') return true;
      return Date.now() - presentedAt <= PUSH_RESPONSE_MAX_AGE_MS;
    };

    const isDuplicatePush = async (identifier: string | undefined): Promise<boolean> => {
      if (!identifier) return false;
      try {
        const raw = await AsyncStorage.getItem(HANDLED_PUSH_KEY);
        const handled: string[] = raw ? (JSON.parse(raw) as string[]) : [];
        if (handled.includes(identifier)) return true;
        const next = [...handled, identifier].slice(-50);
        await AsyncStorage.setItem(HANDLED_PUSH_KEY, JSON.stringify(next));
        return false;
      } catch {
        return false;
      }
    };

    const handleResponse = (
      data: Record<string, unknown> | null | undefined,
      identifier?: string
    ) => {
      if (!data || !mountedRef.current) return;
      if (isRider && data?.type === 'job_request' && data?.deliveryId) {
        const deliveryId = String(data.deliveryId);
        // A push tap and the live realtime INSERT for the same job can both
        // fire: dedupe so one tap never stacks the modal twice.
        void (async () => {
          if (identifier && (await isDuplicatePush(identifier))) return;
          await showJobRequestModal(deliveryId, 'push');
        })();
      } else if (!isRider && data?.type === 'delivery_update' && data?.deliveryId) {
        router.push({ pathname: '/tracking', params: { deliveryId: String(data.deliveryId) } } as any);
      } else {
        const route = isRider ? '/(rider)/notifications' : '/notifications';
        router.push(route as any);
      }
    };
    setNotificationResponseHandler((data) => handleResponse(data));
    // When app was opened from killed state by tapping a notification, the listener can miss it — check once on mount.
    // Guarded by freshness: the OS can hand back a days-old tap, which must
    // not pop a phantom job modal on every login.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response || !mountedRef.current) return;
      if (!isFreshPushResponse(response)) return;
      const data = response?.notification?.request?.content?.data as Record<string, unknown> | undefined;
      if (data) handleResponse(data, response?.notification?.request?.identifier);
    });
    return () => setNotificationResponseHandler(null);
  }, [isRider, showJobRequestModal]);

  const closeDeliveryRequestModal = () => {
    setDeliveryRequestModal({ visible: false, deliveryId: null });
    pendingDeliveryIdRef.current = null;
  };

  const refetchUnreadCount = async () => {
    await fetchUnreadCount();
  };

  const decrementUnreadCount = useCallback((by = 1) => {
    setUnreadCount((prev) => Math.max(0, prev - by));
  }, []);

  const clearUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return (
    <NotificationsContext.Provider
      value={{ unreadCount, refetchUnreadCount, decrementUnreadCount, clearUnreadCount }}
    >
      {children}
      {isRider && (
        <DeliveryRequestModal
          visible={deliveryRequestModal.visible}
          deliveryId={deliveryRequestModal.deliveryId}
          onClose={closeDeliveryRequestModal}
        />
      )}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (ctx === undefined) {
    return {
      unreadCount: 0,
      refetchUnreadCount: async () => {},
      decrementUnreadCount: () => {},
      clearUnreadCount: () => {},
    };
  }
  return ctx;
}

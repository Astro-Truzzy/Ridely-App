import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated from 'react-native-reanimated';
import { ArrowLeft, Bell, Package, DollarSign, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Trash2 } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useAlert } from '@/contexts/AlertContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { useDeliveries } from '@/hooks/useDeliveries';
import { staggeredCardEnter } from '@/lib/riderAnimations';
import { AnimatedPressable } from '@/components/rider/AnimatedPressable';
import { supabase } from '@/lib/supabase';

interface Notification {
  id: string;
  type: 'job_request' | 'payment' | 'system' | 'delivery_update';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionable?: boolean;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { refetchUnreadCount, decrementUnreadCount, clearUnreadCount } = useNotifications();
  const { showAlert, showToast } = useAlert();
  const { deliveries } = useDeliveries();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { animations: animationsEnabled, receiptNotifications } = useAppSettings();
  const enterItem = (i: number) => (animationsEnabled ? staggeredCardEnter(i) : undefined);

  useEffect(() => {
    if (user) {
      fetchNotifications();

      const subscription = supabase
        .channel('rider-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `rider_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.new) {
              if (payload.new.type === 'payment' && !receiptNotifications) return;
              const newNotification: Notification = {
                id: payload.new.id,
                type: payload.new.type,
                title: payload.new.title,
                message: payload.new.message,
                timestamp: new Date(payload.new.created_at),
                read: payload.new.read,
                actionable: payload.new.actionable,
              };
              setNotifications(prev => [newNotification, ...prev]);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `rider_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.new) {
              setNotifications((prev) =>
                prev.map((notif) =>
                  notif.id === payload.new.id ? { ...notif, read: payload.new.read } : notif
                )
              );
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications',
          },
          (payload) => {
            if (payload.old?.id) {
              setNotifications((prev) => prev.filter((notif) => notif.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase as any)
        .from('notifications')
        .select('*')
        .eq('rider_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedNotifications: Notification[] = (data ?? [])
        .filter((item: { type: string }) => receiptNotifications || item.type !== 'payment')
        .map(
        (item: {
          id: string;
          type: string;
          title: string;
          message: string;
          created_at: string;
          read: boolean;
          actionable?: boolean;
        }) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          message: item.message,
          timestamp: new Date(item.created_at),
          read: item.read,
          actionable: item.actionable ?? false,
        })
      );

      setNotifications(formattedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'job_request':
        return <Package size={24} color={theme.colors.primary} strokeWidth={2} />;
      case 'payment':
        return <DollarSign size={24} color={theme.colors.success} strokeWidth={2} />;
      case 'delivery_update':
        return <CheckCircle size={24} color={theme.colors.success} strokeWidth={2} />;
      case 'system':
        return <AlertCircle size={24} color={theme.colors.warning} strokeWidth={2} />;
      default:
        return <Bell size={24} color={theme.colors.textSecondary} strokeWidth={2} />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'job_request':
        return `${theme.colors.primary}20`;
      case 'payment':
        return `${theme.colors.success}20`;
      case 'delivery_update':
        return `${theme.colors.success}20`;
      case 'system':
        return `${theme.colors.warning}20`;
      default:
        return `${theme.colors.textSecondary}20`;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const markAsRead = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.read) return;

    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
    decrementUnreadCount(1);

    const { error } = await (supabase as any)
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (error) {
      console.error('Error marking notification as read:', error);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === id ? { ...notif, read: false } : notif
        )
      );
      await refetchUnreadCount();
      return;
    }

    await refetchUnreadCount();
  };

  const markAllAsRead = async () => {
    if (notifications.every((n) => n.read)) return;

    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    clearUnreadCount();

    if (user?.id) {
      const { error } = await (supabase as any)
        .from('notifications')
        .update({ read: true })
        .eq('rider_id', user.id)
        .eq('read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        await fetchNotifications();
        await refetchUnreadCount();
        return;
      }
    }

    await refetchUnreadCount();
  };

  const deleteNotification = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target) return;

    const index = notifications.findIndex((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (!target.read) decrementUnreadCount(1);

    const { error } = await (supabase as any)
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting notification:', error);
      setNotifications((prev) => {
        const restored = [...prev];
        restored.splice(index < 0 ? 0 : index, 0, target);
        return restored;
      });
      await refetchUnreadCount();
      showToast('Could not delete notification. Please try again.', 'error');
    }
  };

  const confirmDeleteNotification = (id: string) => {
    showAlert('Delete Notification', 'Remove this notification?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteNotification(id) },
    ]);
  };

  const clearAll = async () => {
    if (notifications.length === 0 || !user?.id) return;

    const previous = notifications;
    setNotifications([]);
    clearUnreadCount();

    const { error } = await (supabase as any)
      .from('notifications')
      .delete()
      .eq('rider_id', user.id);

    if (error) {
      console.error('Error clearing notifications:', error);
      setNotifications(previous);
      await refetchUnreadCount();
      showToast('Could not clear notifications. Please try again.', 'error');
    }
  };

  const confirmClearAll = () => {
    showAlert('Clear All', 'Delete all notifications? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: clearAll },
    ]);
  };

  const handleOpenMap = () => {
    const activeDelivery = deliveries.find(
      (d) =>
        d.status !== 'delivered' &&
        d.status !== 'cancelled' &&
        d.status !== 'completed' &&
        d.status !== 'cancelled_no_rider'
    );
    if (activeDelivery) {
      const jobData = {
        id: activeDelivery.id,
        reward: activeDelivery.total_cost,
        parcelSize: activeDelivery.parcel_size,
        pickupAddress: activeDelivery.pickup_address,
        dropoffAddress: activeDelivery.dropoff_address,
        distance: activeDelivery.distance,
        estimatedTime: activeDelivery.estimated_time,
        senderName: 'Customer',
        pickupCoords: null,
        dropoffCoords: null,
      };
      router.push({
        pathname: '/(rider)/active-delivery',
        params: { jobId: activeDelivery.id, jobData: JSON.stringify(jobData) },
      });
    } else {
      router.push('/(rider)/dashboard');
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Header */}
      <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
        <AnimatedPressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.colors.text }]}>Notifications</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <AnimatedPressable style={styles.markAllButton} onPress={markAllAsRead}>
              <Text style={[styles.markAllText, { color: theme.colors.primary }]}>Mark All Read</Text>
            </AnimatedPressable>
          )}
          {notifications.length > 0 && (
            <AnimatedPressable style={styles.clearAllButton} onPress={confirmClearAll}>
              <Text style={[styles.clearAllText, { color: theme.colors.error }]}>Clear All</Text>
            </AnimatedPressable>
          )}
        </View>
      </View>

      {/* Unread Count */}
      {unreadCount > 0 && (
        <View style={styles.unreadContainer}>
          <Text style={[styles.unreadText, { color: theme.colors.textSecondary }]}>
            {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {notifications.map((notification, index) => (
          <Animated.View key={notification.id} entering={enterItem(index)}>
            <AnimatedPressable
              style={[
                styles.notificationCard,
                { backgroundColor: theme.colors.surface },
                !notification.read && { borderLeftWidth: 4, borderLeftColor: theme.colors.primary },
                theme.shadows.small,
              ]}
              onPress={() => {
                markAsRead(notification.id);
                if (notification.type === 'payment') {
                  router.push('/(rider)/earnings');
                }
              }}
            >
            <View style={styles.notificationHeader}>
              <View style={[styles.iconContainer, { backgroundColor: getNotificationColor(notification.type) }]}>
                {getNotificationIcon(notification.type)}
              </View>
              <View style={styles.notificationInfo}>
                <Text style={[styles.notificationTitle, { color: theme.colors.text }]}>
                  {notification.title}
                </Text>
                <Text style={[styles.notificationMessage, { color: theme.colors.textSecondary }]}>
                  {notification.message}
                </Text>
                <Text style={[styles.notificationTime, { color: theme.colors.textTertiary }]}>
                  {formatTime(notification.timestamp)}
                </Text>
              </View>
              <View style={styles.notificationRight}>
                {!notification.read && (
                  <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />
                )}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => confirmDeleteNotification(notification.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={18} color={theme.colors.textTertiary} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </View>

            {notification.actionable && (
              <View style={[styles.actionContainer, { borderTopColor: theme.colors.border }]}>
                {notification.type === 'payment' ? (
                  <AnimatedPressable
                    style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => {
                      markAsRead(notification.id);
                      router.push('/(rider)/earnings');
                    }}
                  >
                    <Text style={styles.actionText}>View receipt</Text>
                  </AnimatedPressable>
                ) : notification.type === 'delivery_update' ? (
                  <AnimatedPressable
                    style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => {
                      markAsRead(notification.id);
                      handleOpenMap();
                    }}
                  >
                    <Text style={styles.actionText}>Open map</Text>
                  </AnimatedPressable>
                ) : (
                  <AnimatedPressable
                    style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => router.push('/(rider)/dashboard')}
                  >
                    <Text style={styles.actionText}>View Jobs</Text>
                  </AnimatedPressable>
                )}
              </View>
            )}
            </AnimatedPressable>
          </Animated.View>
        ))}

        {notifications.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Bell size={48} color={theme.colors.textTertiary} strokeWidth={2} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No notifications</Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              You'll receive notifications about new jobs, payments, and updates here
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markAllButton: {
    padding: 8,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  clearAllButton: {
    padding: 8,
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notificationRight: {
    alignItems: 'center',
    marginLeft: 12,
  },
  deleteButton: {
    padding: 4,
    marginTop: 6,
  },
  unreadContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  unreadText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  notificationCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
});

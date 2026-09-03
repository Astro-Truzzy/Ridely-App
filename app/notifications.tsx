import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  Bell,
  Package,
  DollarSign,
  CircleAlert as AlertCircle,
  CircleCheck as CheckCircle,
  Trash2,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useAlert } from '@/contexts/AlertContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { NotificationCard } from '@/components/NotificationCard';
import { supabase } from '@/lib/supabase';

interface Notification {
  id: string;
  type: 'job_request' | 'payment' | 'system' | 'delivery_update';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionable?: boolean;
  deliveryId?: string | null;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user, userProfile } = useAuth();
  const { refetchUnreadCount, decrementUnreadCount, clearUnreadCount } =
    useNotifications();
  const { showAlert, showToast } = useAlert();
  const { receiptNotifications } = useAppSettings();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();

      // Subscribe to real-time updates
      const subscription = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.new && payload.new.rider_id == null) {
              if (payload.new.type === 'payment' && !receiptNotifications)
                return;
              const newNotification: Notification = {
                id: payload.new.id,
                type: payload.new.type,
                title: payload.new.title,
                message: payload.new.message,
                timestamp: new Date(payload.new.created_at),
                read: payload.new.read,
                actionable: payload.new.actionable,
              };
              setNotifications((prev) => [newNotification, ...prev]);
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.new && payload.new.rider_id == null) {
              setNotifications((prev) =>
                prev.map((notif) =>
                  notif.id === payload.new.id
                    ? { ...notif, read: payload.new.read }
                    : notif,
                ),
              );
            }
          },
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
              setNotifications((prev) =>
                prev.filter((notif) => notif.id !== payload.old.id),
              );
            }
          },
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
        .eq('user_id', user.id)
        .is('rider_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedNotifications: Notification[] = (data ?? [])
        .filter(
          (item: { type: string }) =>
            receiptNotifications || item.type !== 'payment',
        )
        .map(
          (item: {
            id: string;
            type: string;
            title: string;
            message: string;
            created_at: string;
            read: boolean;
            actionable?: boolean;
            delivery_id?: string | null;
          }) => ({
            id: item.id,
            type: item.type,
            title: item.title,
            message: item.message,
            timestamp: new Date(item.created_at),
            read: item.read,
            actionable: item.actionable ?? false,
            deliveryId: item.delivery_id ?? null,
          }),
        );

      setNotifications(formattedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    const stroke = 1.75;
    switch (type) {
      case 'job_request':
        return (
          <Package
            size={18}
            color={theme.colors.primary}
            strokeWidth={stroke}
          />
        );
      case 'payment':
        return (
          <DollarSign
            size={18}
            color={theme.colors.success}
            strokeWidth={stroke}
          />
        );
      case 'delivery_update':
        return (
          <CheckCircle
            size={18}
            color={theme.colors.success}
            strokeWidth={stroke}
          />
        );
      case 'system':
        return (
          <AlertCircle
            size={18}
            color={theme.colors.warning}
            strokeWidth={stroke}
          />
        );
      default:
        return (
          <Bell
            size={18}
            color={theme.colors.textTertiary}
            strokeWidth={stroke}
          />
        );
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'job_request':
        return `${theme.colors.primary}18`;
      case 'payment':
        return `${theme.colors.success}18`;
      case 'delivery_update':
        return `${theme.colors.success}18`;
      case 'system':
        return `${theme.colors.warning}18`;
      default:
        return `${theme.colors.textTertiary}18`;
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

    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif)),
    );
    decrementUnreadCount(1);

    const { error } = await (supabase as any)
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (error) {
      console.error('Error marking notification as read:', error);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === id ? { ...notif, read: false } : notif,
        ),
      );
      await refetchUnreadCount();
      return;
    }

    await refetchUnreadCount();
  };

  const markAllAsRead = async () => {
    if (notifications.every((n) => n.read)) return;

    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
    clearUnreadCount();

    if (user?.id) {
      const { error } = await (supabase as any)
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .is('rider_id', null)
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
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteNotification(id),
      },
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
      .eq('user_id', user.id)
      .is('rider_id', null);

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

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getActionLabel = (notification: Notification) => {
    if (!notification.actionable) return null;
    if (notification.type === 'payment') return 'View receipt';
    if (notification.type === 'delivery_update') return 'Open map';
    return 'View Bookings';
  };

  const handleAction = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.type === 'payment') {
      router.push('/profile/wallet');
      return;
    }
    if (notification.type === 'delivery_update') {
      router.push({
        pathname: '/tracking',
        params: notification.deliveryId
          ? { deliveryId: notification.deliveryId }
          : {},
      });
      return;
    }
    router.push('/(tabs)/bookings');
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Header */}
      <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Notifications
        </Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={markAllAsRead}
            >
              <Text
                style={[styles.markAllText, { color: theme.colors.primary }]}
              >
                Mark All Read
              </Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity
              style={styles.clearAllButton}
              onPress={confirmClearAll}
            >
              <Text
                style={[styles.clearAllText, { color: theme.colors.error }]}
              >
                Clear All
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Unread Count */}
      {unreadCount > 0 && (
        <View style={styles.unreadContainer}>
          <Text
            style={[styles.unreadText, { color: theme.colors.textSecondary }]}
          >
            {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {notifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            title={notification.title}
            message={notification.message}
            timeLabel={formatTime(notification.timestamp)}
            read={notification.read}
            expanded={expandedId === notification.id}
            icon={getNotificationIcon(notification.type)}
            iconBackground={getNotificationColor(notification.type)}
            actionLabel={getActionLabel(notification)}
            onToggle={() => {
              setExpandedId((current) =>
                current === notification.id ? null : notification.id,
              );
              markAsRead(notification.id);
            }}
            onDelete={() => confirmDeleteNotification(notification.id)}
            onAction={() => handleAction(notification)}
          />
        ))}

        {notifications.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Bell size={48} color={theme.colors.textTertiary} strokeWidth={2} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No notifications
            </Text>
            <Text
              style={[styles.emptyText, { color: theme.colors.textSecondary }]}
            >
              You'll receive notifications about your deliveries, payments, and
              updates here
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

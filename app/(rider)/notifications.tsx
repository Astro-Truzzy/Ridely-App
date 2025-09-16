import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { ArrowLeft, Bell, Package, DollarSign, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

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
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'job_request',
      title: 'New Delivery Request',
      message: 'Medium package delivery available - $18.50 reward, 3.2km distance',
      timestamp: new Date(Date.now() - 300000),
      read: false,
      actionable: true,
    },
    {
      id: '2',
      type: 'payment',
      title: 'Payment Received',
      message: 'You received $21.04 for delivery #DEL002',
      timestamp: new Date(Date.now() - 1800000),
      read: false,
    },
    {
      id: '3',
      type: 'delivery_update',
      title: 'Delivery Completed',
      message: 'Delivery #DEL001 has been marked as completed by receiver',
      timestamp: new Date(Date.now() - 3600000),
      read: true,
    },
    {
      id: '4',
      type: 'system',
      title: 'Weekly Earnings Summary',
      message: 'You earned $892.40 this week from 42 completed deliveries',
      timestamp: new Date(Date.now() - 86400000),
      read: true,
    },
    {
      id: '5',
      type: 'system',
      title: 'Document Verification',
      message: 'Your driver\'s license has been successfully verified',
      timestamp: new Date(Date.now() - 172800000),
      read: true,
    },
  ]);

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

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
            <Text style={[styles.markAllText, { color: theme.colors.primary }]}>Mark All Read</Text>
          </TouchableOpacity>
        )}
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
        {notifications.map((notification) => (
          <TouchableOpacity
            key={notification.id}
            style={[
              styles.notificationCard,
              { backgroundColor: theme.colors.surface },
              !notification.read && { borderLeftWidth: 4, borderLeftColor: theme.colors.primary },
              theme.shadows.small
            ]}
            onPress={() => markAsRead(notification.id)}>
            
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
              {!notification.read && (
                <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />
              )}
            </View>

            {notification.actionable && !notification.read && (
              <View style={styles.actionContainer}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => router.push('/(rider)/dashboard')}>
                  <Text style={styles.actionText}>View Jobs</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {notifications.length === 0 && (
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAllText: {
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
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
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
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  actionContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
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
    paddingHorizontal: 40,
  },
});
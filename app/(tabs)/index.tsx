import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Package,
  Clock,
  Bell,
  User,
  MessageCircle,
  Star,
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useAutoCancelPendingDelivery } from '@/hooks/useAutoCancelPendingDelivery';
import { CardSkeletonList } from '@/components/Skeleton';
import { supabase } from '@/lib/supabase';
import Animated, { FadeInUp } from 'react-native-reanimated';
import {
  isCustomerActiveStatus,
  mapCustomerBookingStatus,
} from '@/lib/screenContracts';
import { ActiveDeliveryCard } from '@/components/ActiveDeliveryCard';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { userProfile, user } = useAuth();
  const [userName, setUserName] = useState('');
  const { deliveries, loading: deliveriesLoading, refetch: refetchDeliveries } = useDeliveries();
  const { unreadCount, refetchUnreadCount } = useNotifications();

  useFocusEffect(
    useCallback(() => {
      refetchUnreadCount();
      refetchDeliveries();
    }, [refetchUnreadCount, refetchDeliveries])
  );

  // Get active delivery: searching, assigned, in transit, nearby, or picked up
  const activeDeliveryData = deliveries.find((d) => isCustomerActiveStatus(d.status));
  const isSearchingForRider = activeDeliveryData?.status === 'pending' && !activeDeliveryData?.rider_id;
  const [handoffCode, setHandoffCode] = useState<string | null>(null);

  useEffect(() => {
    if (!activeDeliveryData?.id) {
      setHandoffCode(null);
      return;
    }
    const needsCode =
      activeDeliveryData.status === 'picked_up' ||
      activeDeliveryData.status === 'in_transit' ||
      activeDeliveryData.status === 'nearby';
    if (!needsCode) {
      setHandoffCode(null);
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from('delivery_handoffs')
        .select('code, verified')
        .eq('delivery_id', activeDeliveryData.id)
        .maybeSingle();
      setHandoffCode(data && !data.verified ? data.code : null);
    })();
  }, [activeDeliveryData?.id, activeDeliveryData?.status]);

  // Trigger auto-cancel after 2 min when app is open and still "searching for rider"
  useAutoCancelPendingDelivery(
    activeDeliveryData?.status === 'pending' && !activeDeliveryData?.rider_id ? activeDeliveryData : null
  );

  // Display name: profile first, then sign-up metadata, then email, then fallback
  useEffect(() => {
    const fromProfile = userProfile?.full_name;
    const fromMetadata = user?.user_metadata?.fullName ?? user?.user_metadata?.full_name;
    const fromEmail = userProfile?.email ?? user?.email;
    const name = fromProfile || fromMetadata || fromEmail || 'User';
    setUserName(typeof name === 'string' ? name : 'User');
  }, [userProfile, user]);

  const quickActions = [
    {
      icon: Package,
      title: 'Book Delivery',
      subtitle: 'Send a package',
      color: '#5A47FF',
      onPress: () => router.push('/booking'),
    },
    {
      icon: Clock,
      title: 'Schedule',
      subtitle: 'Plan ahead',
      color: '#FFC947',
      onPress: () => router.push('/booking?scheduleLater=1'),
    },
    {
      icon: Star,
      title: 'Favorites',
      subtitle: 'Quick locations',
      color: '#10B981',
      onPress: () => router.push('/profile/saved-addresses'),
    },
    {
      icon: MessageCircle,
      title: 'Support',
      subtitle: 'Get help',
      color: '#EF4444',
      onPress: () => router.push('/support'),
    },
  ];

  // Two most recent deliveries of any status, excluding the one shown in the active card
  const recentStatusDisplay = (status: string) => {
    if (status === 'cancelled_no_rider') return { label: 'No rider found', color: theme.colors.error };
    switch (mapCustomerBookingStatus(status)) {
      case 'delivered':
        return { label: 'Delivered', color: theme.colors.success };
      case 'cancelled':
        return { label: 'Cancelled', color: theme.colors.error };
      case 'in_transit':
        return { label: 'In progress', color: theme.colors.primary };
      default:
        return { label: 'Pending', color: theme.colors.warning };
    }
  };
  const recentDeliveries = deliveries
    .filter(d => d.id !== activeDeliveryData?.id)
    .slice(0, 2)
    .map(d => {
      const fromPart = (d.pickup_address || '').trim().split(',')[0] || 'Pickup';
      const toPart = (d.dropoff_address || '').trim().split(',')[0] || 'Dropoff';
      const { label, color } = recentStatusDisplay(d.status);
      return {
        id: d.id,
        date: `${new Date(d.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${new Date(d.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
        from: fromPart,
        to: toPart,
        status: label,
        statusColor: color,
        // Cancelled bookings have nothing to track; send them to the bookings list instead
        cancelled: mapCustomerBookingStatus(d.status) === 'cancelled',
        price: `₦${Number(d.total_cost || 0).toLocaleString('en-NG')}`,
      };
    });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: 20 + insets.top }]}>
          <View>
            <Text style={[styles.greeting, { color: theme.colors.text }]}>
              Hello, {userName} 👋
            </Text>
            <Text
              style={[styles.subtitle, { color: theme.colors.textSecondary }]}
            >
              Where would you like to send today?
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.notificationButton,
              { backgroundColor: theme.colors.surface },
              theme.shadows.medium,
            ]}
            onPress={() => router.push('/notifications')}
          >
            <View>
              <Bell size={24} color={theme.colors.primary} strokeWidth={2} />
              {unreadCount > 0 && (
                <View style={[styles.notificationBadge, { backgroundColor: theme.colors.error }]}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Active Delivery Card */}
        {activeDeliveryData && (
          <ActiveDeliveryCard
            delivery={activeDeliveryData}
            searching={!!isSearchingForRider}
            handoffCode={handoffCode}
            onPress={() =>
              router.push({
                pathname: '/tracking',
                params: { deliveryId: activeDeliveryData.id },
              })
            }
          />
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Quick Actions
          </Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.quickActionCard,
                  { backgroundColor: theme.colors.surface },
                  theme.shadows.medium,
                ]}
                onPress={action.onPress}
              >
                <Animated.View entering={FadeInUp.duration(320).delay(index * 55)}>
                  <View
                    style={[
                      styles.quickActionIcon,
                      { backgroundColor: action.color },
                    ]}
                  >
                    <action.icon size={24} color="#FFFFFF" strokeWidth={2} />
                  </View>
                  <Text
                    style={[
                      styles.quickActionTitle,
                      { color: theme.colors.text },
                    ]}
                  >
                    {action.title}
                  </Text>
                  <Text
                    style={[
                      styles.quickActionSubtitle,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    {action.subtitle}
                  </Text>
                </Animated.View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Deliveries */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Recent Deliveries
            </Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/bookings')}>
              <Text
                style={[styles.viewAllText, { color: theme.colors.primary }]}
              >
                View All
              </Text>
            </TouchableOpacity>
          </View>
          {deliveriesLoading ? (
            <CardSkeletonList count={3} />
          ) : recentDeliveries.length === 0 ? (
            <Text style={[styles.emptyRecent, { color: theme.colors.textSecondary }]}>
              No deliveries yet. Your recent bookings will show up here.
            </Text>
          ) : (
          recentDeliveries.map((delivery) => (
            <TouchableOpacity
              key={delivery.id}
              style={[
                styles.deliveryCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                },
                theme.shadows.small,
              ]}
              onPress={() =>
                delivery.cancelled
                  ? router.push('/(tabs)/bookings')
                  : router.push({
                      pathname: '/tracking',
                      params: { deliveryId: delivery.id },
                    })
              }
            >
              <Animated.View entering={FadeInUp.duration(300)} style={styles.deliveryRow}>
                <View style={styles.deliveryInfo}>
                  <Text
                    style={[
                      styles.deliveryDate,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    {delivery.date}
                  </Text>
                  <Text style={[styles.deliveryRoute, { color: theme.colors.text }]}>
                    {delivery.from} → {delivery.to}
                  </Text>
                  <Text
                    style={[
                      styles.deliveryStatus,
                      { color: delivery.statusColor },
                    ]}
                  >
                    {delivery.status}
                  </Text>
                </View>
                <Text
                  style={[styles.deliveryPrice, { color: theme.colors.text }]}
                >
                  {delivery.price}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16, // Adds vertical spacing between rows
  },

  quickActionCard: {
    width: '48%', // Slightly smaller for better spacing
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickActionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },

  quickActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },

  quickActionSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
  },
  deliveryCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deliveryRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  deliveryInfo: {
    flex: 1,
  },
  emptyRecent: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  deliveryDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  deliveryRoute: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  deliveryStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  deliveryPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
});

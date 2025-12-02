import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Package,
  Clock,
  MapPin,
  Bell,
  User,
  MessageCircle,
  Star,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDeliveries } from '@/hooks/useDeliveries';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface ActiveDelivery {
  id: string;
  status: 'picked_up' | 'in_transit' | 'nearby';
  riderName: string;
  estimatedArrival: string;
  fromAddress: string;
  toAddress: string;
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const { userProfile } = useAuth(); // Get user profile from AuthContext
  const [userName, setUserName] = useState(''); // Initialize as empty
  const { deliveries } = useDeliveries();
  
  // Get active delivery (in transit or picked up)
  const activeDeliveryData = deliveries.find(
    d => d.status === 'in_transit' || d.status === 'picked_up' || d.status === 'rider_assigned'
  );
  
  const activeDelivery: ActiveDelivery | null = activeDeliveryData ? {
    id: activeDeliveryData.id,
    status: activeDeliveryData.status === 'picked_up' ? 'picked_up' : 
            activeDeliveryData.status === 'rider_assigned' ? 'in_transit' : 'in_transit',
    riderName: 'Rider', // TODO: Fetch rider name from riders table
    estimatedArrival: activeDeliveryData.estimated_time || '15 mins',
    fromAddress: activeDeliveryData.pickup_address,
    toAddress: activeDeliveryData.dropoff_address,
  } : null;

  // Set the user's name when userProfile is available
  useEffect(() => {
    if (userProfile) {
      setUserName(userProfile.full_name || userProfile.email || 'User');
    } else {
      setUserName('User');
    }
  }, [userProfile]);

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
      onPress: () => router.push('/booking'),
    },
    {
      icon: Star,
      title: 'Favorites',
      subtitle: 'Quick locations',
      color: '#10B981',
      onPress: () => Alert.alert('Feature', 'Favorites coming soon!'),
    },
    {
      icon: MessageCircle,
      title: 'Support',
      subtitle: 'Get help',
      color: '#EF4444',
      onPress: () => router.push('/support'),
    },
  ];

  // Get recent completed deliveries (last 2)
  const recentDeliveries = deliveries
    .filter(d => d.status === 'delivered')
    .slice(0, 2)
    .map(d => ({
      id: d.id.substring(0, 8),
      date: `${new Date(d.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${new Date(d.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
      from: d.pickup_address.split(',')[0], // Get first part of address
      to: d.dropoff_address.split(',')[0],
      status: 'Delivered',
      price: `₦${d.total_cost.toLocaleString('en-NG')}`,
    }));

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
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
            <Bell size={24} color={theme.colors.primary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Active Delivery Card */}
        {activeDelivery && (
          <TouchableOpacity
            style={[
              styles.activeDeliveryCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.primary,
              },
              theme.shadows.large,
            ]}
            onPress={() => router.push('/tracking')}
          >
            <View style={styles.deliveryHeader}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: theme.colors.success },
                ]}
              >
                <Text style={styles.statusText}>In Transit</Text>
              </View>
              <Text
                style={[styles.estimatedTime, { color: theme.colors.primary }]}
              >
                {activeDelivery.estimatedArrival}
              </Text>
            </View>
            <Text style={[styles.riderName, { color: theme.colors.text }]}>
              Rider: {activeDelivery.riderName}
            </Text>
            <View style={styles.addressContainer}>
              <MapPin
                size={16}
                color={theme.colors.textSecondary}
                strokeWidth={2}
              />
              <Text
                style={[
                  styles.addressText,
                  { color: theme.colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {activeDelivery.fromAddress} → {activeDelivery.toAddress}
              </Text>
            </View>
            <Text style={[styles.trackText, { color: theme.colors.primary }]}>
              Tap to track live →
            </Text>
          </TouchableOpacity>
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
                <Animated.View
                  entering={FadeInUp.duration(600)}
                >
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
          {recentDeliveries.map((delivery) => (
            <TouchableOpacity
              key={delivery.id}
              style={[
                styles.deliveryCard,
                { backgroundColor: theme.colors.surface },
                theme.shadows.small,
              ]}
              onPress={() => router.push('/tracking')}
            >
              <Animated.View
                entering={FadeInUp.duration(600)}
              >
                <View style={styles.deliveryInfo}>
                  <Text
                    style={[
                      styles.deliveryDate,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    {delivery.date}
                  </Text>
                  <Text style={styles.deliveryRoute}>
                    {delivery.from} → {delivery.to}
                  </Text>
                  <Text
                    style={[
                      styles.deliveryStatus,
                      { color: theme.colors.success },
                    ]}
                  >
                    ✅ {delivery.status}
                  </Text>
                </View>
                <Text
                  style={[styles.deliveryPrice, { color: theme.colors.text }]}
                >
                  {delivery.price}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          ))}
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
  activeDeliveryCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  estimatedTime: {
    fontSize: 18,
    fontWeight: '700',
  },
  riderName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  trackText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  deliveryInfo: {
    flex: 1,
  },
  deliveryDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  deliveryRoute: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#FFFFFF',
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

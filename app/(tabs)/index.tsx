import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
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
  const [userName] = useState('John Doe');
  const [activeDelivery, setActiveDelivery] = useState<ActiveDelivery | null>({
    id: 'DEL001',
    status: 'in_transit',
    riderName: 'Mike Johnson',
    estimatedArrival: '15 mins',
    fromAddress: '123 Main St, Downtown',
    toAddress: '456 Oak Ave, Uptown',
  });

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

  const recentDeliveries = [
    {
      id: '1',
      date: 'Today, 2:30 PM',
      from: 'Home',
      to: 'Office Building',
      status: 'Delivered',
      price: '$12.50',
    },
    {
      id: '2',
      date: 'Yesterday, 4:15 PM',
      from: 'Mall',
      to: 'Friend\'s Place',
      status: 'Delivered',
      price: '$8.75',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.colors.text }]}>Hello, {userName} 👋</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Where would you like to send today?</Text>
          </View>
          <TouchableOpacity
            style={[styles.notificationButton, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}
            onPress={() => Alert.alert('Notifications', 'No new notifications')}>
            <Bell size={24} color={theme.colors.primary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Active Delivery Card */}
        {activeDelivery && (
          <TouchableOpacity
            style={[styles.activeDeliveryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary }, theme.shadows.large]}
            onPress={() => router.push('/tracking')}>
            <View style={styles.deliveryHeader}>
              <View style={[styles.statusBadge, { backgroundColor: theme.colors.success }]}>
                <Text style={styles.statusText}>In Transit</Text>
              </View>
              <Text style={[styles.estimatedTime, { color: theme.colors.primary }]}>{activeDelivery.estimatedArrival}</Text>
            </View>
            <Text style={[styles.riderName, { color: theme.colors.text }]}>Rider: {activeDelivery.riderName}</Text>
            <View style={styles.addressContainer}>
              <MapPin size={16} color={theme.colors.textSecondary} strokeWidth={2} />
              <Text style={[styles.addressText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {activeDelivery.fromAddress} → {activeDelivery.toAddress}
              </Text>
            </View>
            <Text style={[styles.trackText, { color: theme.colors.primary }]}>Tap to track live →</Text>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.quickActionCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}
                onPress={action.onPress}>
                <View
                  style={[styles.quickActionIcon, { backgroundColor: action.color }]}>
                  <action.icon size={24} color="#FFFFFF" strokeWidth={2} />
                </View>
                <Text style={[styles.quickActionTitle, { color: theme.colors.text }]}>{action.title}</Text>
                <Text style={[styles.quickActionSubtitle, { color: theme.colors.textSecondary }]}>{action.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Deliveries */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Deliveries</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/bookings')}>
              <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View All</Text>
            </TouchableOpacity>
          </View>
          {recentDeliveries.map((delivery) => (
            <TouchableOpacity key={delivery.id} style={[styles.deliveryCard, { backgroundColor: theme.colors.surface }, theme.shadows.small]}>
              <View style={styles.deliveryInfo}>
                <Text style={[styles.deliveryDate, { color: theme.colors.textSecondary }]}>{delivery.date}</Text>
                <Text style={styles.deliveryRoute}>
                  {delivery.from} → {delivery.to}
                </Text>
                <Text style={[styles.deliveryRoute, { color: theme.colors.text }]}>
                  {delivery.from} → {delivery.to}
                </Text>
                <Text style={[styles.deliveryStatus, { color: theme.colors.success }]}>✅ {delivery.status}</Text>
              </View>
              <Text style={[styles.deliveryPrice, { color: theme.colors.text }]}>{delivery.price}</Text>
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
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
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
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickActionCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    width: '48%',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  deliveryCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
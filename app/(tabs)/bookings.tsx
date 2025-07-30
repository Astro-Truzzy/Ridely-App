import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Package, Clock, CheckCircle, XCircle, MapPin } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

interface Booking {
  id: string;
  date: string;
  time: string;
  from: string;
  to: string;
  status: 'delivered' | 'in_transit' | 'pending' | 'cancelled';
  price: string;
  riderName?: string;
  parcelSize: 'small' | 'medium' | 'large';
}

export default function BookingsScreen() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all');

  const bookings: Booking[] = [
    {
      id: 'DEL001',
      date: 'Today',
      time: '2:30 PM',
      from: '123 Main St, Downtown',
      to: '456 Oak Ave, Uptown',
      status: 'in_transit',
      price: 'NGN 5,500',
      riderName: 'Mike Johnson',
      parcelSize: 'medium',
    },
    {
      id: 'DEL002',
      date: 'Today',
      time: '11:15 AM',
      from: 'Home',
      to: 'Office Building',
      status: 'delivered',
      price: 'NGN 3,500',
      riderName: 'Sarah Wilson',
      parcelSize: 'small',
    },
    {
      id: 'DEL003',
      date: 'Yesterday',
      time: '4:45 PM',
      from: 'Shopping Mall',
      to: 'Friend\'s Apartment',
      status: 'delivered',
      price: 'NGN 4,750',
      riderName: 'David Chen',
      parcelSize: 'large',
    },
    {
      id: 'DEL004',
      date: 'Yesterday',
      time: '9:30 AM',
      from: 'Restaurant',
      to: 'Office',
      status: 'cancelled',
      price: 'NGN 2,000',
      parcelSize: 'small',
    },
  ];

  // Update getStatusIcon to use theme colors
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle size={20} color={theme.colors.success} strokeWidth={2} />;
      case 'in_transit':
        return <Package size={20} color={theme.colors.primary} strokeWidth={2} />;
      case 'pending':
        return <Clock size={20} color={theme.colors.warning} strokeWidth={2} />;
      case 'cancelled':
        return <XCircle size={20} color={theme.colors.error} strokeWidth={2} />;
      default:
        return <Package size={20} color={theme.colors.textTertiary} strokeWidth={2} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return theme.colors.success;
      case 'in_transit':
        return theme.colors.primary;
      case 'pending':
        return theme.colors.warning;
      case 'cancelled':
        return theme.colors.error;
      default:
        return theme.colors.textTertiary;
    }
  };

  const getFilteredBookings = () => {
    switch (activeTab) {
      case 'active':
        return bookings.filter(b => b.status === 'in_transit' || b.status === 'pending');
      case 'completed':
        return bookings.filter(b => b.status === 'delivered');
      default:
        return bookings;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text } ]}>My Bookings</Text>
        <TouchableOpacity
          style={[styles.newBookingButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => router.push('/booking')}>
          <Text style={styles.newBookingText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        {(['all', 'active', 'completed'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && { backgroundColor: theme.colors.background, ...theme.shadows.medium }
            ]}
            onPress={() => setActiveTab(tab)}>
            <Text
              style={[
                styles.tabText,
                { color: theme.colors.textSecondary },
                activeTab === tab && { color: theme.colors.primary }
              ]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bookings List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {getFilteredBookings().map((booking) => (
          <TouchableOpacity
            key={booking.id}
            style={[styles.bookingCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}
            onPress={() => {
              if (booking.status === 'in_transit') {
                router.push('/tracking');
              }
            }}>
            <View style={styles.bookingHeader}>
              <View style={styles.bookingInfo}>
                <Text style={[styles.bookingId, { color: theme.colors.text } ]}>#{booking.id}</Text>
                <Text style={[styles.bookingDateTime, { color: theme.colors.textTertiary } ]}>
                  {booking.date} • {booking.time}
                </Text>
              </View>
              <View style={[styles.statusContainer, { backgroundColor: theme.colors.surface }]}>
                {getStatusIcon(booking.status)}
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(booking.status) },
                  ]}>
                  {booking.status.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.addressContainer}>
              <View style={styles.addressRow}>
                <MapPin size={16} color={theme.colors.success} strokeWidth={2} />
                <Text style={[styles.addressText, { color: theme.colors.text } ]} numberOfLines={1}>
                  {booking.from}
                </Text>
              </View>
              <View style={[styles.addressDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.addressRow}>
                <MapPin size={16} color={theme.colors.error} strokeWidth={2} />
                <Text style={[styles.addressText, { color: theme.colors.text } ]} numberOfLines={1}>
                  {booking.to}
                </Text>
              </View>
            </View>

            <View style={styles.bookingFooter}>
              <View style={styles.bookingDetails}>
                <Text style={[styles.parcelSize, { color: theme.colors.textTertiary } ]}>
                  Size: {booking.parcelSize.charAt(0).toUpperCase() + booking.parcelSize.slice(1)}
                </Text>
                {booking.riderName && (
                  <Text style={[styles.riderName, { color: theme.colors.primary } ]}>Rider: {booking.riderName}</Text>
                )}
              </View>
              <Text style={[styles.price, { color: theme.colors.text } ]}>{booking.price}</Text>
            </View>

            {booking.status === 'in_transit' && (
              <View style={styles.actionContainer}>
                <Text style={[styles.trackText, { color: theme.colors.primary } ]}>Tap to track delivery →</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {getFilteredBookings().length === 0 && (
          <View style={styles.emptyState}>
            <Package size={48} color={theme.colors.textTertiary} strokeWidth={2} />
            <Text style={[styles.emptyStateTitle, { color: theme.colors.text } ]}>No bookings found</Text>
            <Text style={[styles.emptyStateText, { color: theme.colors.textTertiary } ]}>
              {activeTab === 'active'
                ? 'You have no active deliveries'
                : activeTab === 'completed'
                ? 'No completed deliveries yet'
                : 'Start by booking your first delivery'}
            </Text>
            <TouchableOpacity
              style={[styles.emptyStateButton, { backgroundColor: theme.colors.primary } ]}
              onPress={() => router.push('/booking')}>
              <Text style={styles.emptyStateButtonText}>Book a Delivery</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Update your styles to remove hardcoded colors where possible
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  newBookingButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newBookingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  bookingCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingId: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  bookingDateTime: {
    fontSize: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  addressContainer: {
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  addressDivider: {
    width: 2,
    height: 20,
    marginLeft: 8,
    marginBottom: 8,
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  bookingDetails: {
    flex: 1,
  },
  parcelSize: {
    fontSize: 12,
    marginBottom: 2,
  },
  riderName: {
    fontSize: 12,
    fontWeight: '500',
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
  },
  actionContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  trackText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  emptyStateButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
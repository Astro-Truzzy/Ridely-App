import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
      price: '$15.75',
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
      price: '$12.50',
      riderName: 'Sarah Wilson',
      parcelSize: 'small',
    },
    {
      id: 'DEL003',
      date: 'Yesterday',
      time: '4:20 PM',
      from: 'Electronics Store',
      to: 'Customer Residence',
      status: 'delivered',
      price: '$22.00',
      riderName: 'Alex Thompson',
      parcelSize: 'large',
    },
    {
      id: 'DEL004',
      date: 'Yesterday',
      time: '10:30 AM',
      from: 'Restaurant',
      to: 'Office Complex',
      status: 'cancelled',
      price: '$8.50',
      parcelSize: 'small',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return '#10B981';
      case 'in_transit':
        return '#5A47FF';
      case 'pending':
        return '#FFC947';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    const iconProps = {
      size: 12,
      strokeWidth: 2,
    };

    switch (status) {
      case 'delivered':
        return <CheckCircle {...iconProps} color={getStatusColor(status)} />;
      case 'in_transit':
        return <Clock {...iconProps} color={getStatusColor(status)} />;
      case 'cancelled':
        return <XCircle {...iconProps} color={getStatusColor(status)} />;
      default:
        return <Clock {...iconProps} color={getStatusColor(status)} />;
    }
  };

  const getFilteredBookings = () => {
    if (activeTab === 'active') {
      return bookings.filter(booking => 
        booking.status === 'in_transit' || booking.status === 'pending'
      );
    }
    
    if (activeTab === 'completed') {
      return bookings.filter(booking => 
        booking.status === 'delivered' || booking.status === 'cancelled'
      );
    }
    
    return bookings;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
    },
    newBookingButton: {
      backgroundColor: theme.colors.primary,
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
      backgroundColor: theme.colors.border,
      marginHorizontal: 20,
      borderRadius: 12,
      padding: 4,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    activeTab: {
      borderBottomColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.textSecondary,
    },
    activeTabText: {
      fontWeight: '600',
      color: theme.colors.primary,
    },
    scrollView: {
      flex: 1,
      paddingHorizontal: 20,
    },
    bookingCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      ...theme.shadows.medium,
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
      color: theme.colors.text,
      marginBottom: 4,
    },
    bookingDateTime: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.border,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '600',
      marginLeft: 4,
      color: theme.colors.textSecondary,
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
      color: theme.colors.text,
      marginLeft: 12,
      flex: 1,
    },
    addressDivider: {
      width: 2,
      height: 20,
      backgroundColor: theme.colors.border,
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
      color: theme.colors.textSecondary,
      marginBottom: 2,
    },
    riderName: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '500',
    },
    price: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    actionContainer: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    trackText: {
      fontSize: 14,
      color: theme.colors.primary,
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
      color: theme.colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyStateText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      paddingHorizontal: 40,
    },
    emptyStateButton: {
      backgroundColor: theme.colors.primary,
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <SafeAreaView style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
        <TouchableOpacity 
          style={styles.newBookingButton}
          onPress={() => router.push('/booking')}
        >
          <Text style={styles.newBookingText}>New Booking</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bookings List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {getFilteredBookings().map(booking => (
          <TouchableOpacity
            key={booking.id}
            style={styles.bookingCard}
            onPress={() => {
              if (booking.status === 'in_transit') {
                router.push('/tracking');
              }
            }}>
            <View style={styles.bookingHeader}>
              <View style={styles.bookingInfo}>
                <Text style={styles.bookingId}>#{booking.id}</Text>
                <Text style={styles.bookingDateTime}>
                  {booking.date} • {booking.time}
                </Text>
              </View>
              <View style={styles.statusContainer}>
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
                <MapPin size={16} color="#10B981" strokeWidth={2} />
                <Text style={styles.addressText} numberOfLines={1}>
                  {booking.from}
                </Text>
              </View>
              <View style={styles.addressDivider} />
              <View style={styles.addressRow}>
                <MapPin size={16} color="#EF4444" strokeWidth={2} />
                <Text style={styles.addressText} numberOfLines={1}>
                  {booking.to}
                </Text>
              </View>
            </View>

            <View style={styles.bookingFooter}>
              <View style={styles.bookingDetails}>
                <Text style={styles.parcelSize}>
                  Size: {booking.parcelSize.charAt(0).toUpperCase() + booking.parcelSize.slice(1)}
                </Text>
                {booking.riderName && (
                  <Text style={styles.riderName}>Rider: {booking.riderName}</Text>
                )}
              </View>
              <Text style={styles.price}>{booking.price}</Text>
            </View>

            {booking.status === 'in_transit' && (
              <View style={styles.actionContainer}>
                <Text style={styles.trackText}>Tap to track delivery →</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {getFilteredBookings().length === 0 && (
          <View style={styles.emptyState}>
            <Package size={48} color={theme.colors.textSecondary} strokeWidth={2} />
            <Text style={styles.emptyStateTitle}>No bookings found</Text>
            <Text style={styles.emptyStateText}>
              {activeTab === 'active'
                ? 'You have no active deliveries'
                : activeTab === 'completed'
                ? 'No completed deliveries yet'
                : 'Start by booking your first delivery'}
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => router.push('/booking')}>
              <Text style={styles.emptyStateButtonText}>Book a Delivery</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { MapPin, Package, DollarSign, Clock, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDeliveries } from '@/hooks/useDeliveries';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 40, 380);

interface DeliveryRequestModalProps {
  visible: boolean;
  deliveryId: string | null;
  onClose: () => void;
}

interface DeliveryDetails {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  parcel_size: string;
  total_cost: number;
  distance: number;
  estimated_time: string;
  status: string;
  rider_id: string | null;
  users?: { full_name?: string } | null;
}

export function DeliveryRequestModal({ visible, deliveryId, onClose }: DeliveryRequestModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { acceptDelivery } = useDeliveries();
  const [delivery, setDelivery] = useState<DeliveryDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!visible || !deliveryId) {
      setDelivery(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('deliveries')
          .select(`
            id,
            pickup_address,
            dropoff_address,
            parcel_size,
            total_cost,
            distance,
            estimated_time,
            status,
            rider_id,
            users:user_id ( full_name )
          `)
          .eq('id', deliveryId)
          .single();
        if (!cancelled && !error && data) {
          setDelivery(data as DeliveryDetails);
        } else if (!cancelled) {
          setDelivery(null);
        }
      } catch {
        if (!cancelled) setDelivery(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, deliveryId]);

  const handleAccept = async () => {
    if (!deliveryId || !user || !delivery) return;
    setAccepting(true);
    try {
      await acceptDelivery(deliveryId);
      const jobData = {
        id: delivery.id,
        reward: delivery.total_cost,
        parcelSize: delivery.parcel_size,
        pickupAddress: delivery.pickup_address,
        dropoffAddress: delivery.dropoff_address,
        distance: delivery.distance,
        estimatedTime: delivery.estimated_time,
        senderName: (delivery.users as { full_name?: string } | null)?.full_name ?? 'Customer',
        pickupCoords: null,
        dropoffCoords: null,
      };
      onClose();
      router.replace({
        pathname: '/(rider)/active-delivery',
        params: { jobId: delivery.id, jobData: JSON.stringify(jobData) },
      });
    } catch (err) {
      setAccepting(false);
      onClose();
      router.push('/(rider)/dashboard');
    }
  };

  const handleReject = () => {
    onClose();
  };

  const parcelLabel = delivery?.parcel_size
    ? `${String(delivery.parcel_size).charAt(0).toUpperCase()}${String(delivery.parcel_size).slice(1)}`
    : '—';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            theme.shadows.large,
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>New delivery request</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={22} color={theme.colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading details…</Text>
            </View>
          ) : delivery && delivery.status === 'pending' && !delivery.rider_id ? (
            <>
              <View style={[styles.detailRow, { borderBottomColor: theme.colors.border }]}>
                <MapPin size={18} color={theme.colors.success} strokeWidth={2} />
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Pickup</Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]} numberOfLines={2}>
                  {delivery.pickup_address}
                </Text>
              </View>
              <View style={[styles.detailRow, { borderBottomColor: theme.colors.border }]}>
                <MapPin size={18} color={theme.colors.error} strokeWidth={2} />
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Dropoff</Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]} numberOfLines={2}>
                  {delivery.dropoff_address}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Package size={16} color={theme.colors.primary} strokeWidth={2} />
                  <Text style={[styles.metaText, { color: theme.colors.text }]}>{parcelLabel}</Text>
                </View>
                <View style={styles.metaItem}>
                  <DollarSign size={16} color={theme.colors.success} strokeWidth={2} />
                  <Text style={[styles.metaText, { color: theme.colors.success }]}>₦{Number(delivery.total_cost).toLocaleString('en-NG')}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Clock size={16} color={theme.colors.textSecondary} strokeWidth={2} />
                  <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>~{delivery.estimated_time}</Text>
                </View>
              </View>
              <Text style={[styles.distanceText, { color: theme.colors.textSecondary }]}>
                {delivery.distance} km
              </Text>

              <View style={[styles.actions, { borderTopColor: theme.colors.border }]}>
                <TouchableOpacity
                  style={[styles.btn, styles.rejectBtn, { borderColor: theme.colors.error }]}
                  onPress={handleReject}
                  disabled={accepting}
                >
                  <X size={20} color={theme.colors.error} strokeWidth={2} />
                  <Text style={[styles.rejectBtnText, { color: theme.colors.error }]}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.acceptBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={handleAccept}
                  disabled={accepting}
                >
                  {accepting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Text style={styles.acceptBtnText}>Accept</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.loadingWrap}>
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                This delivery is no longer available.
              </Text>
              <TouchableOpacity style={[styles.dismissBtn, { backgroundColor: theme.colors.primary }]} onPress={onClose}>
                <Text style={styles.dismissBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  loadingWrap: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    marginTop: 12,
  },
  dismissBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  dismissBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: 52,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '600',
  },
  distanceText: {
    fontSize: 13,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    padding: 16,
    gap: 12,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  rejectBtn: {
    borderWidth: 2,
  },
  rejectBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  acceptBtn: {},
  acceptBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

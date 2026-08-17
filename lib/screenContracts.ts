/** Pure user/rider screen contracts — tested by the QA agent, used by screens. */

import type { DeliveryStatus } from '@/lib/deliveryStatus';

export type CustomerBookingStatus =
  | 'delivered'
  | 'in_transit'
  | 'pending'
  | 'cancelled';

export type LatLng = { latitude: number; longitude: number };

export type RiderJobPayload = {
  id: string;
  reward: number;
  parcelSize: string;
  pickupAddress: string;
  dropoffAddress: string;
  distance: number;
  estimatedTime: string;
  senderName: string;
  pickupCoords: LatLng | null;
  dropoffCoords: LatLng | null;
};

export const CUSTOMER_ACTIVE_STATUSES: DeliveryStatus[] = [
  'pending',
  'accepted',
  'rider_assigned',
  'picked_up',
  'in_transit',
  'nearby',
];

export const RIDER_ACTIVE_STATUSES: DeliveryStatus[] = [
  'accepted',
  'rider_assigned',
  'picked_up',
  'in_transit',
  'nearby',
];

export const COMPLETED_STATUSES: DeliveryStatus[] = ['delivered', 'completed'];

export function isCustomerActiveStatus(status: string): boolean {
  return (CUSTOMER_ACTIVE_STATUSES as string[]).includes(status);
}

export function isRiderActiveStatus(status: string): boolean {
  return (RIDER_ACTIVE_STATUSES as string[]).includes(status);
}

export function isCompletedDeliveryStatus(status: string): boolean {
  return (COMPLETED_STATUSES as string[]).includes(status);
}

export function mapCustomerBookingStatus(status: string): CustomerBookingStatus {
  switch (status) {
    case 'delivered':
    case 'completed':
      return 'delivered';
    case 'in_transit':
    case 'picked_up':
    case 'rider_assigned':
    case 'accepted':
    case 'nearby':
      return 'in_transit';
    case 'cancelled':
    case 'cancelled_no_rider':
      return 'cancelled';
    case 'pending':
    default:
      return 'pending';
  }
}

/** Customers may cancel only while still searching for a rider. */
export function canCustomerCancelDelivery(
  status: string,
  riderId: string | null | undefined
): boolean {
  return status === 'pending' && !riderId;
}

export function homeActiveDeliveryBadge(
  status: string,
  searchingForRider: boolean
): string {
  if (searchingForRider) return 'Searching for rider…';
  if (status === 'nearby') return 'Nearby';
  if (status === 'picked_up' || status === 'in_transit') return 'In Transit';
  if (status === 'accepted' || status === 'rider_assigned') return 'Rider assigned';
  return 'In Transit';
}

export function resolveSignedInHome(
  userType: 'user' | 'rider' | null
): '/(rider)/dashboard' | '/(tabs)' | null {
  if (userType === 'rider') return '/(rider)/dashboard';
  if (userType === 'user') return '/(tabs)';
  return null;
}

export function canContinueBookingPricing(total: number | null | undefined): boolean {
  return typeof total === 'number' && Number.isFinite(total) && total > 0;
}

export function coordsFromLatLng(
  lat?: number | null,
  lng?: number | null
): LatLng | null {
  if (lat == null || lng == null) return null;
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function buildRiderJobPayload(input: {
  id: string;
  total_cost: number;
  parcel_size: string;
  pickup_address: string;
  dropoff_address: string;
  distance: number;
  estimated_time: string;
  senderName?: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
}): RiderJobPayload {
  return {
    id: input.id,
    reward: input.total_cost,
    parcelSize: input.parcel_size,
    pickupAddress: input.pickup_address,
    dropoffAddress: input.dropoff_address,
    distance: input.distance,
    estimatedTime: input.estimated_time,
    senderName: input.senderName ?? 'Customer',
    pickupCoords: coordsFromLatLng(input.pickup_lat, input.pickup_lng),
    dropoffCoords: coordsFromLatLng(input.dropoff_lat, input.dropoff_lng),
  };
}

export function parseRiderJobData(raw: unknown): RiderJobPayload | null {
  if (raw == null) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as Partial<RiderJobPayload>;
    if (!parsed || typeof parsed !== 'object' || !parsed.id) return null;
    return {
      id: String(parsed.id),
      reward: Number(parsed.reward) || 0,
      parcelSize: String(parsed.parcelSize ?? ''),
      pickupAddress: String(parsed.pickupAddress ?? ''),
      dropoffAddress: String(parsed.dropoffAddress ?? ''),
      distance: Number(parsed.distance) || 0,
      estimatedTime: String(parsed.estimatedTime ?? ''),
      senderName: String(parsed.senderName ?? 'Customer'),
      pickupCoords: parsed.pickupCoords ?? null,
      dropoffCoords: parsed.dropoffCoords ?? null,
    };
  } catch {
    return null;
  }
}

export function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

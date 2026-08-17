import {
  mapCustomerBookingStatus,
  canCustomerCancelDelivery,
  isCustomerActiveStatus,
  isRiderActiveStatus,
  isCompletedDeliveryStatus,
  homeActiveDeliveryBadge,
  resolveSignedInHome,
  canContinueBookingPricing,
  parseRiderJobData,
  buildRiderJobPayload,
  coordsFromLatLng,
} from './screenContracts';

describe('user screen contracts', () => {
  it('maps nearby to in-transit so cancel is not offered', () => {
    expect(mapCustomerBookingStatus('nearby')).toBe('in_transit');
    expect(canCustomerCancelDelivery('nearby', 'rider-1')).toBe(false);
    expect(canCustomerCancelDelivery('pending', null)).toBe(true);
    expect(canCustomerCancelDelivery('pending', 'rider-1')).toBe(false);
  });

  it('keeps nearby deliveries on the home active card', () => {
    expect(isCustomerActiveStatus('nearby')).toBe(true);
    expect(isCustomerActiveStatus('accepted')).toBe(true);
    expect(isCustomerActiveStatus('delivered')).toBe(false);
    expect(homeActiveDeliveryBadge('nearby', false)).toBe('Nearby');
    expect(homeActiveDeliveryBadge('pending', true)).toBe('Searching for rider…');
  });

  it('includes completed in recent-delivery lists', () => {
    expect(isCompletedDeliveryStatus('delivered')).toBe(true);
    expect(isCompletedDeliveryStatus('completed')).toBe(true);
    expect(isCompletedDeliveryStatus('nearby')).toBe(false);
  });

  it('does not send riders to customer tabs', () => {
    expect(resolveSignedInHome('rider')).toBe('/(rider)/dashboard');
    expect(resolveSignedInHome('user')).toBe('/(tabs)');
    expect(resolveSignedInHome(null)).toBeNull();
  });

  it('blocks ₦0 pricing continue', () => {
    expect(canContinueBookingPricing(0)).toBe(false);
    expect(canContinueBookingPricing(null)).toBe(false);
    expect(canContinueBookingPricing(750)).toBe(true);
  });
});

describe('rider screen contracts', () => {
  it('treats in-progress jobs as active and pending as not', () => {
    expect(isRiderActiveStatus('accepted')).toBe(true);
    expect(isRiderActiveStatus('nearby')).toBe(true);
    expect(isRiderActiveStatus('pending')).toBe(false);
    expect(isRiderActiveStatus('delivered')).toBe(false);
  });

  it('parses jobData without throwing on junk', () => {
    expect(parseRiderJobData(undefined)).toBeNull();
    expect(parseRiderJobData('{not-json')).toBeNull();
    expect(parseRiderJobData('{"id":"abc","reward":500}')).toMatchObject({
      id: 'abc',
      reward: 500,
    });
    expect(parseRiderJobData(['{"id":"from-array","reward":1}'])).toMatchObject({
      id: 'from-array',
    });
  });

  it('passes stored coordinates into active-delivery payloads', () => {
    const job = buildRiderJobPayload({
      id: 'd1',
      total_cost: 1000,
      parcel_size: 'small',
      pickup_address: 'Pickup',
      dropoff_address: 'Dropoff',
      distance: 4,
      estimated_time: '12 mins',
      senderName: 'Ada',
      pickup_lat: 6.5,
      pickup_lng: 3.3,
      dropoff_lat: 6.6,
      dropoff_lng: 3.4,
    });
    expect(job.pickupCoords).toEqual({ latitude: 6.5, longitude: 3.3 });
    expect(job.dropoffCoords).toEqual({ latitude: 6.6, longitude: 3.4 });
    expect(coordsFromLatLng(null, 1)).toBeNull();
  });
});

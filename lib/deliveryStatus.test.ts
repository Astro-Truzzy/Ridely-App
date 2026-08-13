import { canClientTransition, isTerminalStatus } from './deliveryStatus';

describe('deliveryStatus', () => {
  it('marks terminal statuses', () => {
    expect(isTerminalStatus('delivered')).toBe(true);
    expect(isTerminalStatus('completed')).toBe(true);
    expect(isTerminalStatus('cancelled')).toBe(true);
    expect(isTerminalStatus('pending')).toBe(false);
  });

  it('allows rider picked_up from accepted', () => {
    expect(canClientTransition('accepted', 'picked_up', 'rider')).toBe(true);
    expect(canClientTransition('rider_assigned', 'picked_up', 'rider')).toBe(
      true
    );
  });

  it('blocks customer from marking delivered', () => {
    expect(canClientTransition('nearby', 'delivered', 'customer')).toBe(false);
    expect(canClientTransition('picked_up', 'delivered', 'customer')).toBe(
      false
    );
  });

  it('blocks rider from jumping to delivered (handoff RPC only)', () => {
    expect(canClientTransition('picked_up', 'delivered', 'rider')).toBe(false);
  });

  it('allows cancel from non-terminal for customer and rider', () => {
    expect(canClientTransition('pending', 'cancelled', 'customer')).toBe(true);
    expect(canClientTransition('accepted', 'cancelled', 'rider')).toBe(true);
    expect(canClientTransition('delivered', 'cancelled', 'customer')).toBe(
      false
    );
  });
});

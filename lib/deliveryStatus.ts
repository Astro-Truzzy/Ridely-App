/** Client-side mirror of delivery status transition rules (DB enforces). */

export type DeliveryStatus =
  | 'pending'
  | 'accepted'
  | 'rider_assigned'
  | 'picked_up'
  | 'in_transit'
  | 'nearby'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'cancelled_no_rider';

const TERMINAL: DeliveryStatus[] = [
  'delivered',
  'completed',
  'cancelled',
  'cancelled_no_rider',
];

export function isTerminalStatus(status: DeliveryStatus): boolean {
  return TERMINAL.includes(status);
}

/**
 * Whether an authenticated client role may transition status directly
 * (excluding SECURITY DEFINER RPCs like accept_delivery / verify_delivery_handoff).
 */
export function canClientTransition(
  from: DeliveryStatus,
  to: DeliveryStatus,
  role: 'customer' | 'rider'
): boolean {
  if (from === to) return true;
  if (isTerminalStatus(from)) return false;

  if (to === 'cancelled') {
    return !isTerminalStatus(from);
  }

  if (role === 'rider') {
    if (
      (from === 'accepted' || from === 'rider_assigned') &&
      to === 'picked_up'
    ) {
      return true;
    }
    return false;
  }

  // Customers cannot set delivered/completed — handoff RPC only
  return false;
}

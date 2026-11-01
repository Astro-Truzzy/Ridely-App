import { useState } from 'react';
import { haversineKm } from '@/lib/pricing';

type LatLng = { latitude: number; longitude: number };

/** Ignore GPS jitter below this distance so the trail doesn't zig-zag while parked. */
const MIN_STEP_METERS = 8;
/** A single jump this large is a bad fix (or a teleport after reconnect), not travel. */
const MAX_STEP_METERS = 2000;
const MAX_POINTS = 500;

type TrailState = {
  key: string | null;
  lat: number | null;
  lng: number | null;
  points: LatLng[];
};

export function extendTrail(points: LatLng[], position: LatLng): LatLng[] {
  const last = points[points.length - 1];
  if (!last) return [position];
  const meters =
    haversineKm(
      last.latitude,
      last.longitude,
      position.latitude,
      position.longitude,
    ) * 1000;
  if (meters < MIN_STEP_METERS) return points;
  if (meters > MAX_STEP_METERS) return [position];
  const next = [...points, position];
  return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
}

/**
 * Breadcrumb of where the rider has actually been, built from successive live positions.
 * Starts over when `resetKey` changes (a different delivery). A null position pauses it.
 */
export function useRiderTrail(
  position: LatLng | null,
  resetKey: string | null,
): LatLng[] {
  const [state, setState] = useState<TrailState>({
    key: resetKey,
    lat: null,
    lng: null,
    points: [],
  });

  const valid =
    !!position &&
    Number.isFinite(position.latitude) &&
    Number.isFinite(position.longitude);
  const lat = valid ? position.latitude : null;
  const lng = valid ? position.longitude : null;

  // Adjusting state while rendering (instead of in an effect) avoids an extra paint
  // with a stale trail: https://react.dev/learn/you-might-not-need-an-effect
  if (state.key !== resetKey || state.lat !== lat || state.lng !== lng) {
    const base = state.key === resetKey ? state.points : [];
    setState({
      key: resetKey,
      lat,
      lng,
      points: valid ? extendTrail(base, position) : base,
    });
  }

  return state.points;
}

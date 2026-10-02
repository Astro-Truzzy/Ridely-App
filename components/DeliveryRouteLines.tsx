import React from 'react';

type LatLng = { latitude: number; longitude: number };

/** Brand blue, drawn over a white casing so it stays readable on any map tile. */
export const ROUTE_LINE_COLOR = '#174AFF';
const ROUTE_CASING_COLOR = '#FFFFFF';
/** Brand navy: the path already travelled reads as "done" against the blue route ahead. */
const TRAIL_LINE_COLOR = 'rgba(11, 16, 64, 0.75)';

/**
 * Planned route (outlined) plus the rider's travelled breadcrumb.
 * `Polyline` is passed in because react-native-maps is loaded lazily (absent in Expo Go).
 */
export function DeliveryRouteLines({
  Polyline,
  route,
  trail,
}: {
  Polyline: React.ComponentType<any>;
  route: LatLng[];
  trail: LatLng[];
}) {
  return (
    <>
      {route.length > 1 && (
        <>
          <Polyline
            coordinates={route}
            strokeColor={ROUTE_CASING_COLOR}
            strokeWidth={9}
            lineCap="round"
            lineJoin="round"
            zIndex={1}
          />
          <Polyline
            coordinates={route}
            strokeColor={ROUTE_LINE_COLOR}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
            zIndex={2}
          />
        </>
      )}
      {trail.length > 1 && (
        <Polyline
          coordinates={trail}
          strokeColor={TRAIL_LINE_COLOR}
          strokeWidth={5}
          lineCap="round"
          lineJoin="round"
          zIndex={3}
        />
      )}
    </>
  );
}

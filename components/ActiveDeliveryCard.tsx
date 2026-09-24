import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Constants from 'expo-constants';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  cancelAnimation,
  interpolate,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import { ChevronRight, Clock, KeyRound } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { homeActiveDeliveryBadge } from '@/lib/screenContracts';
import type { Delivery } from '@/hooks/useDeliveries';

const MAP_HEIGHT = 136;
const RING_SIZE = 180;
const PULSE_DURATION = 2400;

// Muted, label-free styles so the map reads as texture behind the beacon.
const LIGHT_MAP_STYLE = [
  { elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#EEF1F6' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#DCE3EE' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D6E2F5' }] },
];

const DARK_MAP_STYLE = [
  { elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#15202E' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#223043' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2C3E57' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0E1826' }] },
];

// Load react-native-maps only in dev builds; Expo Go has no native maps module.
let NativeMapView: React.ComponentType<any> | null = null;

function useNativeMapReady() {
  const [ready, setReady] = useState(NativeMapView != null);
  useEffect(() => {
    if (ready || Platform.OS === 'web' || Constants.appOwnership === 'expo') return;
    let mounted = true;
    import('react-native-maps')
      .then((maps) => {
        NativeMapView = maps.default as unknown as React.ComponentType<any>;
        if (mounted) setReady(true);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [ready]);
  return ready;
}

function statusMessage(status: Delivery['status'], searching: boolean): string {
  if (searching) return 'Pinging riders near your pickup';
  if (status === 'nearby') return 'Your rider is almost there';
  if (status === 'picked_up' || status === 'in_transit') return 'Your package is on its way';
  return 'Your rider is heading to pickup';
}

function PulseRing({ color, delay }: { color: string; delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: PULSE_DURATION, easing: Easing.out(Easing.quad) }), -1, false)
    );
    return () => cancelAnimation(progress);
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 1], [0, 0.55, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.15, 1]) }],
  }));

  return (
    <Animated.View
      style={[styles.ring, { borderColor: color, backgroundColor: `${color}1F` }, animatedStyle]}
    />
  );
}

function LiveDot({ color, animate }: { color: string; animate: boolean }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!animate) return;
    opacity.value = withRepeat(
      withTiming(0.25, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    return () => cancelAnimation(opacity);
  }, [animate, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.liveDot, { backgroundColor: color }, animatedStyle]} />;
}

/** Stylised street grid shown when the native map is unavailable (Expo Go, web, no coords). */
function MapFallback({ isDark }: { isDark: boolean }) {
  const land = isDark ? '#15202E' : '#EEF1F6';
  const road = isDark ? '#223043' : '#FFFFFF';
  const main = isDark ? '#2C3E57' : '#DCE3EE';
  const park = isDark ? '#17302A' : '#DDEFE3';
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 136" preserveAspectRatio="xMidYMid slice">
      <Rect width="400" height="136" fill={land} />
      <Rect x="250" y="84" width="70" height="40" rx="6" fill={park} />
      <Path
        d="M-10 32 L410 20 M-10 118 L410 108 M72 -5 L60 141 M152 -5 L146 141 M236 -5 L228 141 M330 -5 L338 141"
        stroke={road}
        strokeWidth={6}
      />
      <Path
        d="M-10 96 C 80 80, 160 118, 260 70 S 380 40, 410 52"
        stroke={main}
        strokeWidth={11}
        fill="none"
      />
    </Svg>
  );
}

interface ActiveDeliveryCardProps {
  delivery: Delivery;
  searching: boolean;
  handoffCode: string | null;
  onPress: () => void;
}

export function ActiveDeliveryCard({ delivery, searching, handoffCode, onPress }: ActiveDeliveryCardProps) {
  const { theme, isDark } = useTheme();
  const mapReady = useNativeMapReady();
  const reduceMotion = useReducedMotion();

  const accent = searching ? theme.colors.primary : theme.colors.success;
  const badge = homeActiveDeliveryBadge(delivery.status, searching);
  const eta = delivery.estimated_time || '15 mins';
  const hasCoords = delivery.pickup_lat != null && delivery.pickup_lng != null;
  const pillBg = isDark ? 'rgba(15, 20, 25, 0.82)' : 'rgba(255, 255, 255, 0.94)';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${badge}. Estimated ${eta}. Tap to track live.`}
      style={({ pressed }) => [
        styles.shadowWrap,
        !isDark && theme.shadows.large,
        { transform: [{ scale: pressed ? 0.985 : 1 }] },
      ]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: isDark ? `${theme.colors.primary}40` : theme.colors.border,
          },
        ]}
      >
        {/* Map strip with signal beacon */}
        <View style={styles.map} pointerEvents="none">
          <MapFallback isDark={isDark} />
          {mapReady && NativeMapView && hasCoords ? (
            <NativeMapView
              key={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
              initialRegion={{
                latitude: delivery.pickup_lat,
                longitude: delivery.pickup_lng,
                latitudeDelta: 0.012,
                longitudeDelta: 0.012,
              }}
              liteMode
              customMapStyle={isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
              userInterfaceStyle={isDark ? 'dark' : 'light'}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              toolbarEnabled={false}
              showsPointsOfInterest={false}
              showsCompass={false}
            />
          ) : null}

          <View style={styles.beaconLayer}>
            {searching && !reduceMotion ? (
              <>
                <PulseRing color={accent} delay={0} />
                <PulseRing color={accent} delay={PULSE_DURATION / 3} />
                <PulseRing color={accent} delay={(PULSE_DURATION * 2) / 3} />
              </>
            ) : (
              <View style={[styles.staticHalo, { backgroundColor: `${accent}26` }]} />
            )}
            <View style={[styles.beaconOuter, { backgroundColor: theme.colors.surface }]}>
              <View style={[styles.beaconInner, { backgroundColor: accent }]} />
            </View>
          </View>

          <Svg style={styles.fade} preserveAspectRatio="none" viewBox="0 0 1 1">
            <Defs>
              <LinearGradient id="activeDeliveryFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.colors.surface} stopOpacity={0} />
                <Stop offset="1" stopColor={theme.colors.surface} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect width="1" height="1" fill="url(#activeDeliveryFade)" />
          </Svg>

          <View style={styles.pillRow}>
            <View style={[styles.pill, { backgroundColor: pillBg }]}>
              <LiveDot color={accent} animate={searching && !reduceMotion} />
              <Text style={[styles.pillText, { color: theme.colors.text }]} numberOfLines={1}>
                {badge}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: pillBg }]}>
              <Clock size={13} color={theme.colors.primary} strokeWidth={2.5} />
              <Text style={[styles.pillText, { color: theme.colors.primary }]}>{eta}</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={[styles.headline, { color: theme.colors.text }]}>
            {statusMessage(delivery.status, searching)}
          </Text>

          <View style={styles.route}>
            <View style={styles.rail}>
              <View style={[styles.railStart, { borderColor: theme.colors.primary }]} />
              <View style={[styles.railLine, { backgroundColor: theme.colors.border }]} />
              <View style={[styles.railEnd, { backgroundColor: theme.colors.text }]} />
            </View>
            <View style={styles.routeText}>
              <Text style={[styles.address, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {delivery.pickup_address}
              </Text>
              <Text style={[styles.address, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {delivery.dropoff_address}
              </Text>
            </View>
          </View>

          {handoffCode ? (
            <View style={[styles.handoffRow, { backgroundColor: `${theme.colors.primary}18` }]}>
              <KeyRound size={16} color={theme.colors.primary} strokeWidth={2} />
              <Text style={[styles.handoffText, { color: theme.colors.primary }]}>
                Handoff code: <Text style={styles.handoffCode}>{handoffCode}</Text>
              </Text>
            </View>
          ) : null}

          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <Text style={[styles.footerText, { color: theme.colors.primary }]}>Track live</Text>
            <ChevronRight size={18} color={theme.colors.primary} strokeWidth={2.5} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    marginHorizontal: 20,
    marginBottom: 28,
    borderRadius: 20,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  map: {
    height: MAP_HEIGHT,
    overflow: 'hidden',
  },
  beaconLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
  },
  staticHalo: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  beaconOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  beaconInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 44,
  },
  pillRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexShrink: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  headline: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  route: {
    flexDirection: 'row',
    gap: 12,
  },
  rail: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  railStart: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2.5,
  },
  railLine: {
    width: 2,
    flex: 1,
    marginVertical: 3,
  },
  railEnd: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  routeText: {
    flex: 1,
    gap: 10,
  },
  address: {
    fontSize: 14,
  },
  handoffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    padding: 10,
    borderRadius: 10,
  },
  handoffText: {
    fontSize: 13,
    fontWeight: '600',
  },
  handoffCode: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

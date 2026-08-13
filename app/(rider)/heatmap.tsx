import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Flame, MapPin } from 'lucide-react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { AnimatedPressable } from '@/components/rider/AnimatedPressable';
import { supabase } from '@/lib/supabase';

type HeatmapPoint = {
  latitude: number;
  longitude: number;
  weight: number;
};

const LAGOS_REGION = {
  latitude: 6.5244,
  longitude: 3.3792,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

export default function RiderHeatmapScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [RNMaps, setRNMaps] = useState<{
    default: React.ComponentType<any>;
    Heatmap: React.ComponentType<any>;
  } | null>(null);
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) {
      setRNMaps(null);
      return;
    }
    import('react-native-maps')
      .then((maps) => {
        if (mounted) {
          setRNMaps({
            default: maps.default as unknown as React.ComponentType<any>,
            Heatmap: (maps as { Heatmap?: React.ComponentType<any> }).Heatmap as React.ComponentType<any>,
          });
        }
      })
      .catch(() => {
        if (mounted) setRNMaps(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const fetchHeatmap = async () => {
    try {
      const { data, error: rpcError } = await (supabase as any).rpc('get_demand_heatmap');
      if (rpcError) throw rpcError;
      setPoints((data as HeatmapPoint[]) ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load demand data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmap();
    const interval = setInterval(fetchHeatmap, 30_000);
    return () => clearInterval(interval);
  }, []);

  const heatmapData = useMemo(
    () =>
      points.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        weight: Math.max(1, p.weight),
      })),
    [points]
  );

  const totalDemand = points.reduce((sum, p) => sum + p.weight, 0);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.card,
            borderBottomColor: theme.colors.border,
            paddingTop: 16 + insets.top,
          },
        ]}
      >
        <AnimatedPressable
          style={[styles.backButton, { backgroundColor: isDark ? theme.colors.surface : '#F3F4F6' }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </AnimatedPressable>
        <Text style={[styles.title, { color: theme.colors.text }]}>Demand heatmap</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <Flame size={20} color={theme.colors.error} />
          <Text style={[styles.statValue, { color: theme.colors.text }]}>{totalDemand}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Pending jobs</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
          <MapPin size={20} color={theme.colors.primary} />
          <Text style={[styles.statValue, { color: theme.colors.text }]}>{points.length}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Hot zones</Text>
        </View>
      </View>

      <View style={[styles.mapWrap, { backgroundColor: theme.colors.surface }]}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : RNMaps && RNMaps.Heatmap ? (
          <RNMaps.default
            style={styles.map}
            initialRegion={LAGOS_REGION}
            provider={Platform.OS === 'android' ? 'google' : undefined}
          >
            {heatmapData.length > 0 && (
              <RNMaps.Heatmap
                points={heatmapData}
                radius={40}
                opacity={0.7}
                gradient={{
                  colors: ['#00FF00', '#FFFF00', '#FF0000'],
                  startPoints: [0.1, 0.5, 1],
                  colorMapSize: 256,
                }}
              />
            )}
          </RNMaps.default>
        ) : (
          <View style={styles.centered}>
            <MapPin size={40} color={theme.colors.textSecondary} />
            <Text style={[styles.placeholderTitle, { color: theme.colors.text }]}>
              Map requires a development build
            </Text>
            <Text style={[styles.placeholderSub, { color: theme.colors.textSecondary }]}>
              {error ?? `${totalDemand} pending deliveries across ${points.length} zones`}
            </Text>
          </View>
        )}
      </View>

      <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
        Brighter areas show more pending pickup requests. Refreshes every 30s.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '700' },
  placeholder: { width: 40 },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '600' },
  mapWrap: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 320,
  },
  map: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  placeholderSub: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    padding: 16,
    paddingBottom: 24,
  },
});

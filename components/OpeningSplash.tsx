import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Svg, {
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

const RIDER_ART = require('@/assets/images/splash-rider.png');

const COL_W = 168;
const STAGE_H = 248;
const ROAD_W = 26;
const HAIR_W = 1.25;
const HAIR_GAP = 11;
const RIDER_W = 36;
const RIDER_H = 50;
const CX = COL_W / 2;
const ANG = 38;
const SIN = Math.sin((ANG * Math.PI) / 180);
const COS = Math.cos((ANG * Math.PI) / 180);
const UP = 108;
const DIAG = 92;
const DX = DIAG * SIN;
const DY = DIAG * COS;
const TILE_Y = UP + DY;
const TILE_COUNT = 10;
const ORIGIN_Y = TILE_Y * (TILE_COUNT + 1);
const WORLD_H = ORIGIN_Y + 40;
const WORLD_W = COL_W + DX + 24;
const CYCLE_MS = 2000;

function poseAt(p: number) {
  'worklet';
  const tile = Math.floor(p);
  const t = p - tile;
  const even = tile % 2 === 0;
  const xA = even ? CX : CX + DX;
  const xB = even ? CX + DX : CX;
  const turn = even ? ANG : -ANG;
  const y0 = ORIGIN_Y - tile * TILE_Y;
  const yJ = y0 - UP;

  if (t < 0.36) {
    const k = t / 0.36;
    return { x: xA, y: y0 - k * UP, a: 0 };
  }
  if (t < 0.44) {
    const k = (t - 0.36) / 0.08;
    const s = k * k * (3 - 2 * k);
    return { x: xA, y: yJ, a: turn * s };
  }
  if (t < 0.88) {
    const k = (t - 0.44) / 0.44;
    return { x: xA + (xB - xA) * k, y: yJ - DY * k, a: turn };
  }
  if (t < 0.96) {
    const k = (t - 0.88) / 0.08;
    const s = k * k * (3 - 2 * k);
    return { x: xB, y: yJ - DY, a: turn * (1 - s) };
  }
  return { x: xB, y: yJ - DY, a: 0 };
}

function tilePose(i: number) {
  const even = i % 2 === 0;
  const xA = even ? CX : CX + DX;
  const xB = even ? CX + DX : CX;
  const y0 = ORIGIN_Y - i * TILE_Y;
  const yJ = y0 - UP;
  return { xA, xB, y0, yJ, yEnd: yJ - DY };
}

function offsetLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dist: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * dist;
  const oy = (dx / len) * dist;
  return `M ${x1 + ox} ${y1 + oy} L ${x2 + ox} ${y2 + oy}`;
}

function tickMarks(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  step: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const tick = 7;
  const paths: string[] = [];
  for (let d = step; d < len - 6; d += step) {
    const x = x1 + ux * d;
    const y = y1 + uy * d;
    paths.push(
      `M ${x - nx * tick} ${y - ny * tick} L ${x + nx * tick} ${y + ny * tick}`,
    );
  }
  return paths;
}

function RoadMap({
  road,
  shadow,
  hair,
}: {
  road: string;
  shadow: string;
  hair: string;
}) {
  const tiles = Array.from({ length: TILE_COUNT + 1 }, (_, i) => tilePose(i));
  const segs = tiles.flatMap((seg) => [
    { x1: seg.xA, y1: seg.y0 + 16, x2: seg.xA, y2: seg.yJ },
    { x1: seg.xA, y1: seg.yJ, x2: seg.xB, y2: seg.yEnd },
  ]);

  return (
    <Svg width={WORLD_W} height={WORLD_H} style={styles.worldSvg}>
      <G opacity={0.7}>
        {segs.map((s, i) => (
          <G key={`hair-${i}`}>
            <Path
              d={offsetLine(s.x1, s.y1, s.x2, s.y2, ROAD_W / 2 + HAIR_GAP)}
              stroke={hair}
              strokeWidth={HAIR_W}
              strokeLinecap="round"
            />
            <Path
              d={offsetLine(s.x1, s.y1, s.x2, s.y2, -(ROAD_W / 2 + HAIR_GAP))}
              stroke={hair}
              strokeWidth={HAIR_W}
              strokeLinecap="round"
            />
            {tickMarks(s.x1, s.y1, s.x2, s.y2, 34).map((d, ti) => (
              <Path
                key={`t-${i}-${ti}`}
                d={d}
                stroke={hair}
                strokeWidth={HAIR_W}
                strokeLinecap="round"
              />
            ))}
          </G>
        ))}
      </G>
      <G transform="translate(0, 2)" opacity={0.3}>
        {segs.map((s, i) => (
          <Path
            key={`sh-${i}`}
            d={`M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`}
            stroke={shadow}
            strokeWidth={ROAD_W + 3}
            strokeLinecap="round"
          />
        ))}
      </G>
      {segs.map((s, i) => (
        <Path
          key={`rd-${i}`}
          d={`M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`}
          stroke={road}
          strokeWidth={ROAD_W}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

function FogOverlay({ color }: { color: string }) {
  const edge = 28;
  const top = 36;
  const bottom = 52;

  return (
    <Svg
      pointerEvents="none"
      width={COL_W}
      height={STAGE_H}
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        <LinearGradient id="fogLeft" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={color} stopOpacity="1" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="fogRight" x1="1" y1="0" x2="0" y2="0">
          <Stop offset="0" stopColor={color} stopOpacity="1" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="fogTop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="1" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="fogBottom" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0" />
          <Stop offset="1" stopColor={color} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect width={edge} height={STAGE_H} fill="url(#fogLeft)" />
      <Rect
        x={COL_W - edge}
        width={edge}
        height={STAGE_H}
        fill="url(#fogRight)"
      />
      <Rect width={COL_W} height={top} fill="url(#fogTop)" />
      <Rect
        y={STAGE_H - bottom}
        width={COL_W}
        height={bottom}
        fill="url(#fogBottom)"
      />
    </Svg>
  );
}

export function OpeningSplash() {
  const { theme, isDark } = useTheme();
  const progress = useSharedValue(0);
  const focusY = STAGE_H * 0.42;

  const road = isDark ? '#3D4F63' : '#D5DAE3';
  const shadow = isDark ? '#1A2330' : '#C0C6D0';
  const hair = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(31,41,55,0.16)';
  const bg = theme.colors.background;

  useEffect(() => {
    progress.value = withTiming(TILE_COUNT - 1, {
      duration: (TILE_COUNT - 1) * CYCLE_MS,
      easing: Easing.linear,
    });
  }, [progress]);

  const cameraStyle = useAnimatedStyle(() => {
    const pose = poseAt(progress.value);
    return {
      transform: [
        { translateX: COL_W / 2 - pose.x },
        { translateY: focusY - pose.y },
      ],
    };
  });

  const riderStyle = useAnimatedStyle(() => {
    const pose = poseAt(progress.value);
    return {
      transform: [
        { translateX: pose.x - RIDER_W / 2 },
        { translateY: pose.y - RIDER_H / 2 },
        { rotate: `${pose.a}deg` },
      ],
    };
  });

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <View style={styles.stageWrap}>
        <View style={styles.column}>
          <Animated.View
            style={[styles.world, cameraStyle]}
            pointerEvents="none"
          >
            <RoadMap road={road} shadow={shadow} hair={hair} />
            <Animated.View style={[styles.rider, riderStyle]}>
              <Image
                source={RIDER_ART}
                style={styles.riderArt}
                resizeMode="contain"
              />
            </Animated.View>
          </Animated.View>
          <FogOverlay color={bg} />
        </View>
      </View>

      <Animated.View
        entering={FadeInUp.delay(500).duration(480)}
        style={styles.copy}
      >
        <Text style={styles.wordmark}>
          <Text style={{ color: theme.colors.text }}>Ride</Text>
          <Text style={{ color: theme.colors.primary }}>ly</Text>
        </Text>
        <Text style={[styles.tagline, { color: theme.colors.textSecondary }]}>
          Book, track and deliver anything around your city — in a few taps.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
  stageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  column: {
    width: COL_W,
    height: STAGE_H,
    overflow: 'hidden',
  },
  world: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: WORLD_W,
    height: WORLD_H,
  },
  worldSvg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  rider: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: RIDER_W,
    height: RIDER_H,
  },
  riderArt: {
    width: RIDER_W,
    height: RIDER_H,
  },
  copy: {
    paddingHorizontal: 36,
    paddingBottom: 56,
    alignItems: 'center',
  },
  wordmark: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
});

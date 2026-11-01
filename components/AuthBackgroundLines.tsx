import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Quiet topographic / route-map lines for auth screens.
 * Sits behind content and ignores touches.
 */
function AuthBackgroundLinesComponent() {
  const { isDark } = useTheme();

  const ink = isDark ? 'rgba(71, 132, 255, 0.16)' : 'rgba(90, 71, 255, 0.10)';
  const whisper = isDark ? 'rgba(243, 244, 246, 0.055)' : 'rgba(31, 41, 55, 0.055)';
  const node = isDark ? 'rgba(71, 132, 255, 0.22)' : 'rgba(90, 71, 255, 0.16)';

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
      >
        <Circle cx="348" cy="72" r="148" stroke={whisper} strokeWidth="1" fill="none" />
        <Circle cx="348" cy="72" r="214" stroke={ink} strokeWidth="1" fill="none" />
        <Circle cx="348" cy="72" r="286" stroke={whisper} strokeWidth="1" fill="none" />
        <Circle cx="348" cy="72" r="356" stroke={ink} strokeWidth="0.8" fill="none" />

        <Circle cx="18" cy="790" r="132" stroke={whisper} strokeWidth="1" fill="none" />
        <Circle cx="18" cy="790" r="198" stroke={ink} strokeWidth="1" fill="none" />
        <Circle cx="18" cy="790" r="268" stroke={whisper} strokeWidth="1" fill="none" />

        <Circle cx="-36" cy="248" r="168" stroke={whisper} strokeWidth="1" fill="none" />

        <Path
          d="M-40 188 C 72 92, 168 268, 292 154 S 430 48, 470 196"
          stroke={ink}
          strokeWidth="1.15"
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M-28 312 C 86 214, 196 392, 318 268 S 458 188, 504 332"
          stroke={whisper}
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M 24 458 C 118 382, 176 546, 286 468 S 372 392, 416 508"
          stroke={ink}
          strokeWidth="1.1"
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M-48 638 C 76 548, 186 724, 304 632 S 448 548, 508 704"
          stroke={whisper}
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M 52 -20 C 108 96, 36 196, 128 278 S 74 412, 168 498"
          stroke={ink}
          strokeWidth="0.9"
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M 410 360 C 318 408, 352 512, 248 560 S 168 640, 212 742"
          stroke={whisper}
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />

        <Circle cx="292" cy="154" r="3.2" fill={node} />
        <Circle cx="286" cy="468" r="2.8" fill={node} />
        <Circle cx="304" cy="632" r="2.6" fill={node} />
        <Circle cx="128" cy="278" r="2.4" fill={node} />
        <Circle cx="248" cy="560" r="2.2" fill={node} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
});

export const AuthBackgroundLines = memo(AuthBackgroundLinesComponent);

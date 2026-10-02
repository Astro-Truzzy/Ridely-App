import React, { forwardRef, useMemo } from 'react';
import { Text as RNText, StyleSheet, TextProps, TextStyle } from 'react-native';
import { useTypography } from '@/contexts/TypographyContext';
import { scaleTextStyle } from '@/lib/typography';

/**
 * Drop-in replacement for React Native's `Text` that applies the user's
 * accessibility text size.
 *
 * Every screen declares font sizes in static `StyleSheet.create` blocks, so
 * there is no token layer to scale. Instead this reads the resolved style at
 * render and appends an override — the appended object wins because it comes
 * later in the array, and the shared StyleSheet is never mutated.
 *
 * Nested `<Text>` with no explicit size inherits the already-scaled size from
 * its parent, so it passes through untouched and is never double-scaled.
 */
const ScaledText = forwardRef<RNText, TextProps>(function ScaledText(props, ref) {
  const { fontScale } = useTypography();

  // At the default scale we skip the flatten entirely, so users who never
  // change this setting pay nothing beyond the extra component layer.
  const flat = fontScale === 1 || props.style == null ? undefined : StyleSheet.flatten(props.style);

  const fontSize = flat?.fontSize;
  const lineHeight = flat?.lineHeight;

  const scaled = useMemo<TextStyle | undefined>(
    () => scaleTextStyle({ fontSize, lineHeight }, fontScale) as TextStyle | undefined,
    [fontSize, lineHeight, fontScale]
  );

  const style = scaled ? [props.style, scaled] : props.style;

  return <RNText ref={ref} {...props} style={style} />;
});

ScaledText.displayName = 'ScaledText';

export const Text = ScaledText;
export default ScaledText;

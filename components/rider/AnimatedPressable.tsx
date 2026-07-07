import React, { memo, useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const PRESS_SCALE = 0.97;
const SPRING_CONFIG = { damping: 18, stiffness: 260 };

interface AnimatedPressableProps {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export const AnimatedPressable = memo(function AnimatedPressable({
  children,
  onPress,
  style,
  disabled = false,
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!disabled)
        .onBegin(() => {
          scale.value = withSpring(PRESS_SCALE, SPRING_CONFIG);
        })
        .onFinalize(() => {
          scale.value = withSpring(1, SPRING_CONFIG);
        })
        .onEnd(() => {
          if (!disabled) runOnJS(onPress)();
        }),
    [disabled, onPress, scale]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={[style, animatedStyle, disabled && { opacity: 0.6 }]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
});

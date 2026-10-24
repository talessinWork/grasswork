import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { color, motion } from '../theme';

interface Props {
  /** 0..1 */
  value: number;
  height?: number;
  track?: string;
  fill?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Thin rounded bar that eases slowly to its value. */
export function ProgressBar({ value, height = 6, track = color.mist, fill = color.moss, accessibilityLabel, style }: Props) {
  const v = Math.max(0, Math.min(1, value));
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(v, { duration: motion.slow, easing: Easing.out(Easing.cubic) });
  }, [v, p]);
  const bar = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={[{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }, style]}
    >
      <Animated.View style={[{ height: '100%', borderRadius: height / 2, backgroundColor: fill }, bar]} />
    </View>
  );
}

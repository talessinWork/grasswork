/** Mist segmented control (tone picker, goal tabs). The selected segment is a paper chip that slides. */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Txt } from '../Txt';
import { color, motion, radius } from '../theme';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange(v: T): void;
  /** 'radio' for a radiogroup (tone), 'tab' for a tablist (goal) */
  role?: 'radio' | 'tab';
  accessibilityLabel: string;
}

const PAD = 4;
const GAP = 4;

export function Segmented<T extends string>({ options, value, onChange, role = 'radio', accessibilityLabel }: Props<T>) {
  const [width, setWidth] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const segW = width > 0 ? (width - PAD * 2 - GAP * (options.length - 1)) / options.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withTiming(idx * (segW + GAP), { duration: motion.calm, easing: Easing.out(Easing.cubic) });
  }, [idx, segW, x]);

  const chip = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      accessibilityRole={role === 'tab' ? 'tablist' : 'radiogroup'}
      accessibilityLabel={accessibilityLabel}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={styles.track}
    >
      {segW > 0 && <Animated.View style={[styles.chip, { width: segW }, chip]} />}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole={role}
            accessibilityState={role === 'tab' ? { selected } : { checked: selected }}
            accessibilityLabel={o.label}
            style={styles.seg}
          >
            <Txt variant={selected ? 'bodySemi' : 'bodyMedium'} style={styles.label}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', gap: GAP, padding: PAD, borderRadius: radius.md, backgroundColor: color.mist },
  chip: { position: 'absolute', top: PAD, left: PAD, bottom: PAD, borderRadius: radius.sm, backgroundColor: color.paper },
  seg: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  label: { fontSize: 14 },
});

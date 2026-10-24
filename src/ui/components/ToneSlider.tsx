/**
 * 3-stop tone slider (Polite / Sassy / Unhinged) from the Attitude artboard.
 * Tap a label or drag the knob; it snaps to the nearest stop. Adjustable via accessibility actions.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Tone } from '../../core/types';
import { Txt } from '../Txt';
import { color, motion } from '../theme';

const TONES: Tone[] = ['polite', 'sassy', 'unhinged'];
const LABELS: Record<Tone, string> = { polite: 'Polite', sassy: 'Sassy', unhinged: 'Unhinged' };
const KNOB = 28;

interface Props {
  value: Tone;
  onChange(t: Tone): void;
}

export function ToneSlider({ value, onChange }: Props) {
  const [width, setWidth] = useState(0);
  const idx = TONES.indexOf(value);
  const x = useSharedValue(0);
  const w = useSharedValue(0);

  useEffect(() => {
    w.value = width;
    x.value = withTiming((idx / 2) * width, { duration: motion.calm, easing: Easing.out(Easing.cubic) });
  }, [idx, width, x, w]);

  const commit = (i: number) => {
    const t = TONES[Math.max(0, Math.min(2, i))];
    if (t !== value) onChange(t);
    else x.value = withTiming((idx / 2) * width, { duration: motion.calm });
  };

  const pan = Gesture.Pan()
    .minDistance(2)
    .onChange((e) => {
      x.value = Math.max(0, Math.min(w.value, x.value + e.changeX));
    })
    .onEnd(() => {
      const i = w.value > 0 ? Math.round((x.value / w.value) * 2) : 0;
      runOnJS(commit)(i);
    });

  const fill = useAnimatedStyle(() => ({ width: x.value }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - KNOB / 2 }] }));

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Gus's tone"
      accessibilityValue={{ text: LABELS[value] }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => commit(idx + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
      style={styles.wrap}
    >
      <View style={styles.labels}>
        {TONES.map((t, i) => (
          <Pressable key={t} onPress={() => commit(i)} hitSlop={12} style={styles.labelHit}>
            <Txt variant={t === value ? 'smallSemi' : 'small'} color={t === value ? 'ink' : 'muted'}>
              {LABELS[t]}
            </Txt>
          </Pressable>
        ))}
      </View>
      <GestureDetector gesture={pan}>
        <View style={styles.trackHit} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, fill]} />
          </View>
          <Animated.View style={[styles.knob, knob]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  labelHit: { minHeight: 24, justifyContent: 'center' },
  trackHit: { height: 44, justifyContent: 'center', marginHorizontal: KNOB / 2 },
  track: { height: 8, borderRadius: 4, backgroundColor: color.mist, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: color.moss },
  knob: {
    position: 'absolute',
    left: 0,
    top: (44 - KNOB) / 2,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: color.paper,
    borderWidth: 3,
    borderColor: color.moss,
  },
});

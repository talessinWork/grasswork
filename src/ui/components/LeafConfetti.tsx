/**
 * Leaf confetti for the rank-up screen: a short drift of moss and ember leaves, then calm.
 * With reduce-motion the leaves are simply placed, as on the artboard.
 */
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { color } from '../theme';

/** artboard leaf positions (390-wide board), rotation, palette */
const LEAVES = [
  { x: 40, y: 60, r: 0, c: color.leafLight, s: 1 },
  { x: 320, y: 40, r: 30, c: color.leafLight, s: 1 },
  { x: 300, y: 180, r: -40, c: color.leafLight, s: 1 },
  { x: 60, y: 220, r: 60, c: color.leafLight, s: 1 },
  { x: 180, y: 30, r: -20, c: color.emberLight, s: 0.8 },
  { x: 350, y: 120, r: 0, c: color.emberLight, s: 0.8 },
  { x: 20, y: 150, r: 45, c: color.emberLight, s: 0.8 },
  { x: 240, y: 90, r: 15, c: color.leafLight, s: 0.7 },
  { x: 120, y: 120, r: -60, c: color.emberLight, s: 0.7 },
];

function Leaf({ leaf, i, scaleX, reduce }: { leaf: (typeof LEAVES)[number]; i: number; scaleX: number; reduce: boolean }) {
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    p.value = withDelay(i * 90, withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }));
  }, [p, i, reduce]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.1 ? p.value * 10 : 1,
    transform: [
      { translateY: (1 - p.value) * -160 },
      { translateX: Math.sin(p.value * Math.PI * 2 + i) * 12 * (1 - p.value) },
      { rotate: `${leaf.r + (1 - p.value) * 220}deg` },
    ],
  }));
  const w = 24 * leaf.s;
  return (
    <Animated.View style={[styles.leaf, { left: leaf.x * scaleX, top: leaf.y }, style]}>
      <Svg width={w} height={w * 0.6} viewBox="0 -6 24 14">
        <Path d="M0 0 c8 -10 20 -10 24 0 c-8 8 -18 8 -24 0z" fill={leaf.c} />
      </Svg>
    </Animated.View>
  );
}

export function LeafConfetti() {
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {LEAVES.map((l, i) => (
        <Leaf key={i} leaf={l} i={i} scaleX={width / 390} reduce={reduce} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ leaf: { position: 'absolute' } });

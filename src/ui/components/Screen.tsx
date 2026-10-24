/** Screen scaffolding: safe-area padded ground with the 24 pt gutter, optional scroll, and a slow fade-in. */
import { useEffect, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, layout, motion } from '../theme';

interface Props {
  children: ReactNode;
  bg?: string;
  scroll?: boolean;
  /** extra top padding beyond the safe area (artboards: 56–72 pt from the top edge incl. status bar) */
  top?: number;
  /** include the bottom safe area (screens without a tab bar) */
  bottomInset?: boolean;
  gap?: number;
  /** pinned under the scroll content (primary action) */
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function FadeIn({ children, style, delay = 0 }: { children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const reduce = useReducedMotion();
  const o = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => {
      o.value = withTiming(1, { duration: motion.slow });
    }, delay);
    return () => clearTimeout(t);
  }, [o, reduce, delay]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: (1 - o.value) * 6 }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

export function Screen({ children, bg = color.stone, scroll = false, top = 12, bottomInset = false, gap = 20, footer, style }: Props) {
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: insets.top + top,
    paddingHorizontal: layout.gutter,
    paddingBottom: bottomInset ? Math.max(insets.bottom, 16) + 16 : 20,
  };
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[pad, { gap, flexGrow: 1 }, footer ? { paddingBottom: 16 } : null, style]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, pad, { gap }, footer ? { paddingBottom: 16 } : null, style]}>{children}</View>
  );
  return (
    <View style={[styles.flex, { backgroundColor: bg }]}>
      <FadeIn style={styles.flex}>{body}</FadeIn>
      {footer ? (
        <View style={{ paddingHorizontal: layout.gutter, paddingBottom: bottomInset ? Math.max(insets.bottom, 16) + 16 : 16, gap: 12 }}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });

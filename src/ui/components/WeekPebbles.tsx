/** Seven pebbles for the last week: moss = done, ember = frozen/rest (streak kept), dashed = today. Pebbles fill in with a slow fade. */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { WeekDot } from '../../services/contract';
import { Txt } from '../Txt';
import { color, font, motion } from '../theme';

const STATUS_TEXT: Record<WeekDot['status'], string> = {
  done: 'done',
  frozen: 'saved by a streak freeze',
  rest: 'rest day',
  missed: 'missed',
  today: 'today, not done yet',
  future: 'not started',
};

function fillFor(status: WeekDot['status']): string | null {
  switch (status) {
    case 'done':
      return color.moss;
    case 'frozen':
    case 'rest':
      return color.ember;
    case 'missed':
      return color.line;
    default:
      return null;
  }
}

function Pebble({ dot, index, dusk }: { dot: WeekDot; index: number; dusk: boolean }) {
  const fill = fillFor(dot.status);
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withDelay(index * 60, withTiming(1, { duration: motion.slow }));
  }, [o, index]);
  const fade = useAnimatedStyle(() => ({ opacity: o.value }));
  const isToday = dot.status === 'today';
  const isFuture = dot.status === 'future';
  return (
    <View style={styles.col}>
      <Animated.View
        style={[
          styles.pebble,
          fill ? { backgroundColor: fill } : null,
          isToday && { width: 24, height: 24, borderWidth: 2, borderStyle: 'dashed', borderColor: color.moss, margin: 2 },
          isFuture && { borderWidth: 1.5, borderColor: dusk ? color.duskLine : color.line },
          fade,
        ]}
      />
      <Txt variant="caption" color={dusk ? 'duskMuted' : isToday ? 'ink' : 'muted'} style={isToday && styles.today}>
        {dot.label}
      </Txt>
    </View>
  );
}

export function WeekPebbles({ week, dusk = false }: { week: WeekDot[]; dusk?: boolean }) {
  const summary = week.map((d) => `${d.label}: ${STATUS_TEXT[d.status]}`).join(', ');
  return (
    <View style={styles.row} accessible accessibilityLabel={`This week. ${summary}`}>
      {week.map((d, i) => (
        <Pebble key={d.date} dot={d} index={i} dusk={dusk} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  col: { alignItems: 'center', gap: 6 },
  pebble: { width: 28, height: 28, borderRadius: 14 },
  today: { fontFamily: font.bodySemi },
});

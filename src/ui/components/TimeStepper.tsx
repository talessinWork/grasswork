/**
 * 'HH:MM' picker without a native dependency: − / + in 15-minute steps around a big display time.
 * Adjustable for screen readers (increment / decrement).
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { formatHHMM, parseHHMM } from '../../core/util';
import { Txt, type TxtVariant } from '../Txt';
import { color, hit } from '../theme';
import { Icon } from './Icon';

interface Props {
  value: string;
  onChange(v: string): void;
  label: string;
  stepMin?: number;
  variant?: TxtVariant;
}

export function TimeStepper({ value, onChange, label, stepMin = 15, variant = 'timer' }: Props) {
  const shift = (d: number) => {
    const m = parseHHMM(value) + d;
    // snap to the step grid
    onChange(formatHHMM(Math.round(m / stepMin) * stepMin));
  };
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => shift(e.nativeEvent.actionName === 'increment' ? stepMin : -stepMin)}
    >
      <StepBtn icon="minus" onPress={() => shift(-stepMin)} />
      <Txt variant={variant} style={styles.time}>
        {value}
      </Txt>
      <StepBtn icon="plus" onPress={() => shift(stepMin)} />
    </View>
  );
}

function StepBtn({ icon, onPress }: { icon: 'minus' | 'plus'; onPress(): void }) {
  return (
    <Pressable
      onPress={onPress}
      importantForAccessibility="no"
      accessibilityElementsHidden
      hitSlop={6}
      style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name={icon} size={18} color="muted" strokeWidth={2.4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { fontVariant: ['tabular-nums'] },
  btn: { width: hit, height: hit, borderRadius: hit / 2, backgroundColor: color.stone, alignItems: 'center', justifyContent: 'center' },
});

/** Moss switch from the artboards (52×32 / 44×26). The whole row is the hit target when used via ToggleRow. */
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Txt } from '../Txt';
import { color, hit, motion } from '../theme';

interface ToggleProps {
  value: boolean;
  onChange(next: boolean): void;
  label: string;
  size?: 'md' | 'sm';
  disabled?: boolean;
}

export function Toggle({ value, onChange, label, size = 'md', disabled }: ToggleProps) {
  const w = size === 'md' ? 52 : 44;
  const h = size === 'md' ? 32 : 26;
  const knob = h - 6;
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(value ? 1 : 0, { duration: motion.calm / 2 });
  }, [value, p]);
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], [color.pending, color.moss]) }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: p.value * (w - knob - 6) }] }));
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      hitSlop={{ top: (hit - h) / 2, bottom: (hit - h) / 2, left: 8, right: 8 }}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Animated.View style={[{ width: w, height: h, borderRadius: h / 2, padding: 3 }, track]}>
        <Animated.View style={[{ width: knob, height: knob, borderRadius: knob / 2, backgroundColor: color.paper }, thumb]} />
      </Animated.View>
    </Pressable>
  );
}

interface RowProps {
  title: string;
  /** bold leading part, e.g. a time "07:45" */
  lead?: string;
  subtitle?: string;
  value: boolean;
  onChange(next: boolean): void;
  divider?: boolean;
  size?: 'md' | 'sm';
}

export function ToggleRow({ title, lead, subtitle, value, onChange, divider, size = 'sm' }: RowProps) {
  const label = [lead, title].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={subtitle ? `${label}. ${subtitle}` : label}
      accessibilityState={{ checked: value }}
      style={[styles.row, divider && styles.divider]}
    >
      <View style={styles.text}>
        <Txt variant={subtitle ? 'bodySemi' : 'body'}>
          {lead ? <Txt variant="bodySemi" style={styles.tabular}>{lead}</Txt> : null}
          {lead ? ' · ' : ''}
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="small" color="muted">
            {subtitle}
          </Txt>
        ) : null}
      </View>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Toggle value={value} onChange={onChange} label={label} size={size} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: hit, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: color.lineSoft },
  text: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
});

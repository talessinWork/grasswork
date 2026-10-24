/**
 * Small rounded labels. 'met'/'missing' are the rule chips (green = rule met, ember = still missing);
 * 'cameraMet'/'cameraMissing' are the same over the camera. Chips cross-fade slowly when they flip.
 */
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Txt } from '../Txt';
import { color, motion, radius, type ColorToken } from '../theme';
import { Icon, type IconName } from './Icon';

type Tone = 'met' | 'missing' | 'cameraMet' | 'cameraMissing' | 'glass' | 'paper' | 'emberDusk' | 'reward' | 'rankGlass';

const TONES: Record<Tone, { bg: string; fg: ColorToken; border?: string }> = {
  met: { bg: color.mossSoft, fg: 'mossDeep' },
  missing: { bg: color.emberSoft, fg: 'emberInk' },
  cameraMet: { bg: color.jointOkSoft, fg: 'jointOkText' },
  cameraMissing: { bg: color.jointBadSoft, fg: 'jointBad' },
  glass: { bg: color.cameraGlass, fg: 'cameraInk' },
  paper: { bg: color.paper, fg: 'ink' },
  emberDusk: { bg: color.duskEmber, fg: 'emberLight' },
  reward: { bg: color.emberLight, fg: 'emberDeep' },
  rankGlass: { bg: color.rankGlassStrong, fg: 'paper' },
};

interface PillProps {
  label: string;
  tone?: Tone;
  icon?: IconName;
  iconColor?: ColorToken;
  size?: 'sm' | 'md';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Pill({ label, tone = 'paper', icon, iconColor, size = 'sm', accessibilityLabel, style }: PillProps) {
  const t = TONES[tone];
  const md = size === 'md';
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.pill,
        { backgroundColor: t.bg, height: md ? 36 : undefined, paddingVertical: md ? 0 : 6, paddingHorizontal: md ? 12 : 12 },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={16} strokeWidth={2.2} color={iconColor ?? t.fg} />}
      <Txt variant={md ? 'bodySemi' : 'smallSemi'} color={t.fg}>
        {label}
      </Txt>
    </View>
  );
}

/** Rule chip that flips between met and missing with a slow color fade. */
export function RuleChip({ label, met, camera = false }: { label: string; met: boolean; camera?: boolean }) {
  const p = useSharedValue(met ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(met ? 1 : 0, { duration: motion.calm });
  }, [met, p]);
  const off = camera ? TONES.cameraMissing : TONES.missing;
  const on = camera ? TONES.cameraMet : TONES.met;
  const bg = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], [off.bg, on.bg]) }));
  return (
    <Animated.View
      accessible
      accessibilityLabel={`${label}: ${met ? 'met' : 'not yet'}`}
      style={[styles.pill, { paddingVertical: 6, paddingHorizontal: 12 }, bg]}
    >
      <Txt variant="smallSemi" color={met ? on.fg : off.fg}>
        {label}
      </Txt>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, alignSelf: 'flex-start' },
});

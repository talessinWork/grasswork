/** The one primary action per screen, plus quiet secondary variants. Pill-shaped, ≥ 44 pt tall. */
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Txt } from '../Txt';
import { color, font, layout, type ColorToken } from '../theme';
import { Icon, type IconName } from './Icon';

export type ButtonVariant =
  | 'primary' // ink on stone
  | 'ember' // evening rescue
  | 'outlineDusk' // evening secondary
  | 'light' // forest / rank-up grounds
  | 'secondary'; // paper with hairline (e.g. "It hurts")

interface Props {
  label: string;
  onPress(): void;
  variant?: ButtonVariant;
  icon?: IconName;
  /** second line under the label (rescue button) */
  sublabel?: string;
  size?: 'md' | 'lg' | 'xl';
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const V: Record<ButtonVariant, { bg: string; fg: ColorToken; border?: string }> = {
  primary: { bg: color.ink, fg: 'paper' },
  ember: { bg: color.ember, fg: 'dusk' },
  outlineDusk: { bg: color.transparent, fg: 'duskInk', border: color.duskLine },
  light: { bg: color.paper, fg: 'forest' },
  secondary: { bg: color.paper, fg: 'ink', border: color.line },
};

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  sublabel,
  size = 'md',
  disabled,
  loading,
  accessibilityHint,
  style,
}: Props) {
  const v = V[variant];
  const height = sublabel ? 72 : size === 'lg' ? layout.buttonHeightLarge : size === 'xl' ? 72 : layout.buttonHeight;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={sublabel ? `${label}. ${sublabel}` : label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: height,
          borderRadius: height / 2,
          backgroundColor: v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color[v.fg]} />
      ) : sublabel ? (
        <View style={styles.stack}>
          <Txt variant="lead" color={v.fg} style={styles.bold}>
            {label}
          </Txt>
          <Txt variant="smallSemi" color={v.fg} style={styles.medium}>
            {sublabel}
          </Txt>
        </View>
      ) : (
        <View style={styles.row}>
          {icon && <Icon name={icon} size={18} color={v.fg} />}
          <Txt
            variant="lead"
            color={v.fg}
            style={[size !== 'md' && styles.large, (variant === 'light' || size === 'lg') && styles.bold]}
          >
            {label}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stack: { alignItems: 'center', gap: 2 },
  large: { fontSize: 18, lineHeight: 24 },
  // only Figtree 400/500/600 are loaded; never set fontWeight on custom families (Android drops the family)
  bold: { fontFamily: font.bodySemi },
  medium: { fontFamily: font.bodyMedium },
});

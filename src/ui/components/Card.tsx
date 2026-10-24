import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { color, radius } from '../theme';

type CardTone = 'paper' | 'moss' | 'dusk' | 'forest' | 'rank';

const BG: Record<CardTone, string> = {
  paper: color.paper,
  moss: color.mossSoft,
  dusk: color.duskCard,
  forest: color.forestGlass,
  rank: color.rankGlass,
};

interface Props {
  children: ReactNode;
  tone?: CardTone;
  /** corner radius: 'lg' 20 (small tiles), 'xl' 24 (sections), 'xxl' 28 (sheets) */
  r?: 'lg' | 'xl' | 'xxl';
  padding?: number;
  gap?: number;
  onPress?(): void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, tone = 'paper', r = 'xl', padding = 16, gap = 0, onPress, accessibilityLabel, accessibilityHint, style }: Props) {
  const base = [styles.card, { backgroundColor: BG[tone], borderRadius: radius[r], padding, gap }, style];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [...base, { opacity: pressed ? 0.85 : 1 }]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={base} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ card: { overflow: 'hidden' } });

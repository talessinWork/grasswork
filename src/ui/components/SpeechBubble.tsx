import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Txt } from '../Txt';
import { color } from '../theme';

interface Props {
  children: ReactNode;
  /** 'tail' = speech tail bottom-left (Gus beside it); 'round' = centered bubble (evening) */
  shape?: 'tail' | 'round';
  tone?: 'paper' | 'stone' | 'dusk';
  style?: StyleProp<ViewStyle>;
}

const BG = { paper: color.paper, stone: color.stone, dusk: color.duskCard };

export function SpeechBubble({ children, shape = 'tail', tone = 'paper', style }: Props) {
  return (
    <View
      accessibilityRole="text"
      style={[
        styles.bubble,
        { backgroundColor: BG[tone] },
        shape === 'tail' ? styles.tail : styles.round,
        style,
      ]}
    >
      <Txt variant="body" color={tone === 'dusk' ? 'duskInk' : 'ink'} align={shape === 'round' ? 'center' : undefined}>
        {children}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { paddingVertical: 12, paddingHorizontal: 16 },
  tail: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 18, borderBottomLeftRadius: 4 },
  round: { borderRadius: 18 },
});

import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { color as palette, font, fontScale, type ColorToken } from './theme';

/** Type scale from the GUI review. Display sizes cap their Dynamic Type growth so layouts hold. */
const variants = StyleSheet.create({
  hero: { fontFamily: font.display, fontSize: 104, lineHeight: 100, letterSpacing: -4 },
  display: { fontFamily: font.display, fontSize: 44, lineHeight: 48, letterSpacing: -0.9 },
  timer: { fontFamily: font.display, fontSize: 40, lineHeight: 44, letterSpacing: -0.8 },
  h1: { fontFamily: font.display, fontSize: 34, lineHeight: 36, letterSpacing: -0.7 },
  h2: { fontFamily: font.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.4 },
  title: { fontFamily: font.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.26 },
  stat: { fontFamily: font.display, fontSize: 22, lineHeight: 26 },
  lead: { fontFamily: font.bodySemi, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 21 },
  bodyMedium: { fontFamily: font.bodyMedium, fontSize: 15, lineHeight: 21 },
  bodySemi: { fontFamily: font.bodySemi, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: font.body, fontSize: 13, lineHeight: 18 },
  smallSemi: { fontFamily: font.bodySemi, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.body, fontSize: 12, lineHeight: 16 },
  eyebrow: { fontFamily: font.bodySemi, fontSize: 12, lineHeight: 16, letterSpacing: 1.44, textTransform: 'uppercase' },
});

export type TxtVariant = keyof typeof variants;

const DISPLAY: TxtVariant[] = ['hero', 'display', 'timer', 'h1', 'h2', 'title', 'stat'];

export interface TxtProps extends TextProps {
  variant?: TxtVariant;
  color?: ColorToken;
  align?: TextStyle['textAlign'];
}

export function Txt({ variant = 'body', color = 'ink', align, style, maxFontSizeMultiplier, ...rest }: TxtProps) {
  const cap = maxFontSizeMultiplier ?? (DISPLAY.includes(variant) ? fontScale.display : fontScale.body);
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={cap}
      style={[variants[variant], { color: palette[color] }, align ? { textAlign: align } : null, style]}
    />
  );
}

/**
 * Gus: a grass sprout on a pebble body. Exact paths from Main.dc.html (viewBox 0 0 120 150).
 * The sprout layer sways gently around its root; the pebble stays put. Respects reduce-motion.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { GusMood } from '../../core/types';
import { color, font } from '../theme';

export interface GusProps {
  mood: GusMood;
  /** rendered width; height follows the 120:150 artboard ratio */
  size?: number;
  /** dusk palette: darker ground shadow and face strokes (evening home) */
  dusk?: boolean;
  /** summary variant: extra leaf and closed happy eyes ("Gus grew a new leaf") */
  grown?: boolean;
  /** hide the ground shadow (e.g. small inline Gus next to a speech bubble) */
  noGround?: boolean;
  sway?: boolean;
}

const MOOD_LABEL: Record<GusMood, string> = {
  thriving: 'Gus is thriving',
  waiting: 'Gus is waiting',
  wilting: 'Gus is wilting',
  dormant: 'Gus is dormant',
};

export function Gus({ mood, size = 96, dusk = false, grown = false, noGround = false, sway = true }: GusProps) {
  const height = (size * 150) / 120;
  const reduceMotion = useReducedMotion();
  const angle = useSharedValue(0);

  // dormant Gus doesn't sway; wilting Gus sways slower and smaller
  const amplitude = mood === 'dormant' ? 0 : mood === 'wilting' ? 1.2 : 2.4;
  const period = mood === 'wilting' ? 5200 : 3600;

  useEffect(() => {
    if (!sway || reduceMotion || amplitude === 0) {
      cancelAnimation(angle);
      angle.value = 0;
      return;
    }
    angle.value = -amplitude;
    angle.value = withRepeat(withTiming(amplitude, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(angle);
  }, [sway, reduceMotion, amplitude, period, angle]);

  const swayStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));

  const ground = dusk ? color.duskGround : color.mist;
  const face = dusk ? color.dusk : color.paper;

  return (
    <View
      style={{ width: size, height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={MOOD_LABEL[mood]}
    >
      {/* body + ground */}
      <Svg width={size} height={height} viewBox="0 0 120 150" style={StyleSheet.absoluteFill}>
        {!noGround && <Ellipse cx={60} cy={142} rx={34} ry={5} fill={ground} />}
        <Body mood={mood} face={face} grown={grown} />
      </Svg>
      {/* sprout, rotating around its root at (60, 92) */}
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: '50% 61.3%' }, swayStyle]} pointerEvents="none">
        <Svg width={size} height={height} viewBox="0 0 120 150">
          <Sprout mood={mood} grown={grown} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function Sprout({ mood, grown }: { mood: GusMood; grown: boolean }) {
  if (mood === 'thriving' && grown) {
    return (
      <>
        <Path d="M60 92 V36" stroke={color.moss} strokeWidth={5} strokeLinecap="round" />
        <Path d="M60 56 C44 54 28 40 30 18 C50 20 60 36 60 56Z" fill={color.leafLight} />
        <Path d="M60 46 C74 38 94 34 98 12 C78 10 62 24 60 46Z" fill={color.leaf} />
        <Path d="M60 40 C56 30 58 20 64 12" stroke={color.leafLight} strokeWidth={4} fill="none" strokeLinecap="round" />
      </>
    );
  }
  switch (mood) {
    case 'thriving':
      return (
        <>
          <Path d="M60 92 V40" stroke={color.moss} strokeWidth={5} strokeLinecap="round" />
          <Path d="M60 58 C44 56 30 42 32 22 C50 24 60 40 60 58Z" fill={color.leafLight} />
          <Path d="M60 48 C74 40 92 36 96 16 C78 14 62 28 60 48Z" fill={color.leaf} />
        </>
      );
    case 'waiting':
      return (
        <>
          <Path d="M60 92 V52" stroke={color.moss} strokeWidth={5} strokeLinecap="round" />
          <Path d="M60 66 C46 64 36 54 36 38 C52 40 60 52 60 66Z" fill={color.leafLight} />
          <Path d="M60 58 C72 52 86 50 90 34 C74 32 62 42 60 58Z" fill={color.leaf} />
        </>
      );
    case 'wilting':
      return (
        <>
          <Path d="M60 92 C60 72 64 62 72 56" stroke={color.wiltStem} strokeWidth={5} fill="none" strokeLinecap="round" />
          <Path d="M68 58 C58 62 44 74 42 90 C56 86 66 74 68 58Z" fill={color.wiltLeaf} />
          <Path d="M72 56 C84 60 94 72 94 88 C82 84 74 72 72 56Z" fill={color.wiltLeafDark} />
        </>
      );
    case 'dormant':
      return <Path d="M60 92 C58 84 52 80 44 82" stroke={color.dormant} strokeWidth={5} fill="none" strokeLinecap="round" />;
  }
}

function Body({ mood, face, grown }: { mood: GusMood; face: string; grown: boolean }) {
  const bodyFill = mood === 'wilting' ? color.wiltStem : mood === 'dormant' ? color.dormant : color.moss;
  const s = { stroke: face, strokeWidth: 2.5, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <>
      <Rect x={30} y={90} width={60} height={48} rx={24} fill={bodyFill} />
      {mood === 'thriving' && grown && (
        <>
          <Path {...s} d="M45 110 Q50 105 55 110 M65 110 Q70 105 75 110" />
          <Path {...s} d="M50 120 Q60 130 70 120" />
        </>
      )}
      {mood === 'thriving' && !grown && (
        <>
          <Circle cx={50} cy={110} r={3.5} fill={face} />
          <Circle cx={70} cy={110} r={3.5} fill={face} />
          <Path {...s} d="M52 121 Q60 128 68 121" />
        </>
      )}
      {mood === 'waiting' && (
        <>
          <Circle cx={50} cy={111} r={3.5} fill={face} />
          <Circle cx={70} cy={111} r={3.5} fill={face} />
          <Path {...s} d="M53 123 H67" />
        </>
      )}
      {mood === 'wilting' && (
        <>
          <Path {...s} d="M46 111 H54 M66 111 H74" />
          <Path {...s} d="M52 126 Q60 120 68 126" />
        </>
      )}
      {mood === 'dormant' && (
        <>
          <Path {...s} d="M46 112 H54 M66 112 H74" />
          <SvgText x={84} y={84} fontSize={14} fill={color.muted} fontFamily={font.body}>
            z
          </SvgText>
          <SvgText x={94} y={72} fontSize={11} fill={color.muted} fontFamily={font.body}>
            z
          </SvgText>
        </>
      )}
    </>
  );
}

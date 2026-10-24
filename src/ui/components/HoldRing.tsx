/**
 * Ring timer. Fills only while the pose is valid (the caller passes verified progress).
 * Breath pacer: the inner halo glows up over 4 s (breathe in) and fades over 6 s (breathe out),
 * and the caption follows. With reduce-motion the halo stays still; the caption still paces.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { mmss } from '../format';
import { color, font, motion } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type BreathPhase = 'in' | 'out';

/** Alternates 'in' (4 s) / 'out' (6 s) while active. */
export function useBreath(active: boolean): BreathPhase {
  const [phase, setPhase] = useState<BreathPhase>('in');
  useEffect(() => {
    if (!active) {
      setPhase('in');
      return;
    }
    const t = setTimeout(() => setPhase((p) => (p === 'in' ? 'out' : 'in')), phase === 'in' ? motion.breathInMs : motion.breathOutMs);
    return () => clearTimeout(t);
  }, [active, phase]);
  return phase;
}

interface Props {
  /** 0..1 verified progress */
  progress: number;
  heldS: number;
  targetS: number;
  /** pose currently valid: ring is bright and the breath pacer runs */
  live: boolean;
  /** 'camera' over the dark camera ground, 'light' on stone */
  variant?: 'camera' | 'light';
  size?: number;
  /** caption override (e.g. "get into position") */
  caption?: string;
}

export function HoldRing({ progress, heldS, targetS, live, variant = 'camera', size = 168, caption }: Props) {
  const reduceMotion = useReducedMotion();
  const breath = useBreath(live);
  const r = 72;
  const c = 2 * Math.PI * r;
  const cam = variant === 'camera';
  const track = cam ? color.cameraTrack : color.mist;
  const fill = cam ? color.jointOk : color.moss;
  const ink = cam ? color.cameraInk : color.ink;
  const muted = cam ? color.cameraMuted : color.muted;

  const p = useSharedValue(progress);
  useEffect(() => {
    // frames arrive ~15/s; a short linear tween keeps the arc smooth between them
    p.value = withTiming(Math.max(0, Math.min(1, progress)), { duration: 180, easing: Easing.linear });
  }, [progress, p]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));

  const glow = useSharedValue(0.35);
  useEffect(() => {
    if (!live || reduceMotion) {
      cancelAnimation(glow);
      glow.value = withTiming(0.35, { duration: motion.calm });
      return;
    }
    glow.value =
      breath === 'in'
        ? withTiming(0.9, { duration: motion.breathInMs, easing: Easing.inOut(Easing.sin) })
        : withTiming(0.15, { duration: motion.breathOutMs, easing: Easing.inOut(Easing.sin) });
  }, [breath, live, reduceMotion, glow]);
  const halo = useAnimatedProps(() => ({ strokeOpacity: glow.value, strokeWidth: 1 + glow.value * 5 }));

  const sub = caption ?? `of ${mmss(targetS)}${live ? ` · breathe ${breath}` : ''}`;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Held ${Math.floor(heldS)} of ${Math.round(targetS)} seconds`}
      accessibilityValue={{ min: 0, max: Math.round(targetS), now: Math.floor(heldS) }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 168 168">
        <Circle cx={84} cy={84} r={r} fill="none" stroke={track} strokeWidth={10} />
        <AnimatedCircle
          cx={84}
          cy={84}
          r={r}
          fill="none"
          stroke={fill}
          strokeOpacity={live || progress >= 1 ? 1 : 0.55}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          animatedProps={arc}
          transform="rotate(-90 84 84)"
        />
        <AnimatedCircle cx={84} cy={84} r={58} fill="none" stroke={fill} animatedProps={halo} />
        <SvgText x={84} y={92} textAnchor="middle" fontFamily={font.display} fontSize={40} fill={ink}>
          {mmss(heldS)}
        </SvgText>
        <SvgText x={84} y={116} textAnchor="middle" fontFamily={font.body} fontSize={13} fill={muted}>
          {sub}
        </SvgText>
      </Svg>
    </View>
  );
}

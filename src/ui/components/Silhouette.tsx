/** End-pose silhouettes from the onboarding goal cards (64×56), reused on the rest screen as "next pose" preview. */
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';
import type { SilhouetteKind } from '../session/display';
import { color as palette } from '../theme';

interface Props {
  kind: SilhouetteKind;
  size?: number;
  ink?: string;
  floor?: string;
}

export function Silhouette({ kind, size = 64, ink = palette.ink, floor = palette.ghost }: Props) {
  const s = { stroke: ink, strokeWidth: 4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const h = (size * 56) / 64;
  return (
    <Svg width={size} height={h} viewBox="0 0 64 56" accessible={false}>
      <Line x1={4} y1={52} x2={60} y2={52} stroke={floor} strokeWidth={2} strokeDasharray="4 4" />
      {kind === 'squat' && (
        <>
          <Polyline {...s} points="26,50 38,34 22,42" />
          <Line {...s} x1={22} y1={42} x2={34} y2={16} />
          <Line {...s} x1={33} y1={20} x2={50} y2={28} />
          <Circle cx={37} cy={10} r={6} fill={ink} />
        </>
      )}
      {kind === 'fold' && (
        <>
          <Line {...s} x1={24} y1={50} x2={24} y2={16} />
          <Polyline {...s} points="24,16 40,30 44,50" />
          <Circle cx={46} cy={38} r={6} fill={ink} />
        </>
      )}
      {kind === 'split' && (
        <>
          <Polyline {...s} points="4,50 32,46 60,50" />
          <Line {...s} x1={32} y1={46} x2={32} y2={20} />
          <Circle cx={32} cy={12} r={6} fill={ink} />
        </>
      )}
      {kind === 'bridge' && (
        <>
          <Path {...s} d="M10 50 Q14 18 34 18 Q52 18 54 50" />
          <Circle cx={14} cy={42} r={5} fill={ink} />
        </>
      )}
      {kind === 'overhead' && (
        <>
          <Line {...s} x1={32} y1={50} x2={32} y2={22} />
          <Line {...s} x1={32} y1={24} x2={32} y2={2} />
          <Circle cx={38} cy={18} r={5} fill={ink} />
        </>
      )}
      {kind === 'straddle' && (
        <>
          <Polyline {...s} points="6,50 32,44 58,50" />
          <Line {...s} x1={32} y1={44} x2={40} y2={26} />
          <Circle cx={44} cy={18} r={6} fill={ink} />
        </>
      )}
      {kind === 'couch' && (
        <>
          {/* back shin up the wall, front foot planted, torso upright */}
          <Polyline {...s} points="8,24 10,50 28,50" />
          <Polyline {...s} points="28,50 30,30 44,36 46,50" />
          <Line {...s} x1={30} y1={30} x2={30} y2={12} />
          <Circle cx={31} cy={7} r={5} fill={ink} />
        </>
      )}
    </Svg>
  );
}

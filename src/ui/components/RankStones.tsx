/** Stepping stones for a goal's rank ladder (Path artboard): done = moss + check, current = outlined, locked = mist. */
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Ellipse, G, Line, Path, Text as SvgText } from 'react-native-svg';
import type { PathVM } from '../../services/contract';
import { color, font } from '../theme';

interface Props {
  ranks: PathVM['ranks'];
  /** 0..1 toward the current stone */
  progress: number;
}

const H = 70;
const EDGE = 30;

export function RankStones({ ranks, progress }: Props) {
  const [w, setW] = useState(0);
  const n = ranks.length;
  const step = n > 1 ? (w - EDGE * 2) / (n - 1) : 0;
  const cx = (i: number) => (n > 1 ? EDGE + i * step : w / 2);
  const currentIdx = ranks.findIndex((r) => r.state === 'current');
  const lastDone = ranks.map((r) => r.state).lastIndexOf('done');
  // progress line: to the last done stone, plus the fraction toward the current one
  const reachX =
    currentIdx > 0 ? cx(currentIdx - 1) + step * Math.max(0, Math.min(1, progress)) : lastDone >= 0 ? cx(lastDone) : EDGE;
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);

  const label = ranks
    .map((r) => `${r.name} ${r.state === 'done' ? 'done' : r.state === 'current' ? `current, ${pct}%` : 'ahead'}`)
    .join(', ');

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={{ height: H }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Rank stones: ${label}`}
    >
      {w > 0 && (
        <Svg width={w} height={H}>
          <Line x1={EDGE} y1={26} x2={w - EDGE} y2={26} stroke={color.mist} strokeWidth={4} strokeLinecap="round" />
          {reachX > EDGE && <Line x1={EDGE} y1={26} x2={reachX} y2={26} stroke={color.moss} strokeWidth={4} strokeLinecap="round" />}
          {ranks.map((r, i) => {
            const x = cx(i);
            const current = r.state === 'current';
            return (
              <G key={r.name}>
                {r.state === 'done' && (
                  <>
                    <Ellipse cx={x} cy={26} rx={20} ry={16} fill={color.moss} />
                    <Path
                      d={`M${x - 8} 26l5 5 10-10`}
                      stroke={color.paper}
                      strokeWidth={3}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                )}
                {current && <Ellipse cx={x} cy={26} rx={22} ry={18} fill={color.paper} stroke={color.moss} strokeWidth={4} />}
                {r.state === 'locked' && <Ellipse cx={x} cy={26} rx={20} ry={16} fill={color.mist} />}
                <SvgText
                  x={x}
                  y={62}
                  textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}
                  dx={i === 0 && n > 1 ? -EDGE + 4 : i === n - 1 && n > 1 ? EDGE - 4 : 0}
                  fontSize={12}
                  fontFamily={current ? font.bodySemi : font.body}
                  fill={current ? color.ink : color.muted}
                >
                  {current ? `${r.name} · ${pct}%` : r.name}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

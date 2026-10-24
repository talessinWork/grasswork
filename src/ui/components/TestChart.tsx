/**
 * Weekly-test line chart (Path artboard): one point per weekly test, dashed reference line,
 * personal bests in moss, the latest point as an ember dot with its value.
 * y is drawn so that "deeper" is always up, whichever direction the unit runs.
 */
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import type { TestPoint } from '../../services/contract';
import { color, font } from '../theme';

interface Props {
  points: TestPoint[];
  unit: string;
  referenceLabel: string;
  /** true when larger values are deeper (cm below knee); false for "cm to floor" */
  higherIsDeeper: boolean;
}

const H = 150;
const PAD_L = 24;
const PAD_R = 24;
const TOP = 34;
const BOTTOM = 124;

export function TestChart({ points, unit, referenceLabel, higherIsDeeper }: Props) {
  const [w, setW] = useState(0);
  const values = points.map((p) => (higherIsDeeper ? p.value : -p.value));
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const y = (v: number) => BOTTOM - ((v - lo) / span) * (BOTTOM - TOP);
  const n = points.length;
  const x = (i: number) => (n > 1 ? PAD_L + (i * (w - PAD_L - PAD_R)) / (n - 1) : w / 2);
  const refY = y(0);
  const last = n ? points[n - 1] : null;
  const fmt = (v: number) => `${v > 0 && higherIsDeeper ? '+' : ''}${v} ${unit}`;

  const desc =
    n === 0
      ? 'No weekly tests yet'
      : `${n} weekly tests. First ${fmt(points[0].value)}, latest ${fmt(points[n - 1].value)}. Reference line at ${referenceLabel}.`;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height: H }} accessible accessibilityRole="image" accessibilityLabel={desc}>
      {w > 0 && (
        <Svg width={w} height={H}>
          <Line x1={16} y1={refY} x2={w - 12} y2={refY} stroke={color.ghost} strokeWidth={1} strokeDasharray="4 4" />
          <SvgText x={w - 12} y={refY - 6} textAnchor="end" fontSize={11} fontFamily={font.body} fill={color.muted}>
            {referenceLabel}
          </SvgText>
          {n > 1 && (
            <Polyline
              points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              fill="none"
              stroke={color.moss}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {values.map((v, i) =>
            i === n - 1 ? null : (
              <Circle key={i} cx={x(i)} cy={y(v)} r={points[i].personalBest ? 4.5 : 3.5} fill={points[i].personalBest ? color.moss : color.leaf} />
            ),
          )}
          {last && (
            <>
              <Circle cx={x(n - 1)} cy={y(values[n - 1])} r={6} fill={color.ember} />
              <SvgText
                x={x(n - 1)}
                y={Math.max(14, y(values[n - 1]) - 15)}
                textAnchor={n > 1 ? 'end' : 'middle'}
                fontSize={12}
                fontFamily={font.bodySemi}
                fill={color.ink}
              >
                {fmt(last.value)}
              </SvgText>
            </>
          )}
          {n > 0 && (
            <SvgText x={x(0)} y={144} textAnchor="middle" fontSize={11} fontFamily={font.body} fill={color.muted}>
              W1
            </SvgText>
          )}
          {n > 1 && (
            <SvgText x={x(n - 1)} y={144} textAnchor="middle" fontSize={11} fontFamily={font.body} fill={color.muted}>
              {`W${n}`}
            </SvgText>
          )}
        </Svg>
      )}
    </View>
  );
}

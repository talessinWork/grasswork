/** Calibrating + framing (Framing artboard): headline hint, ghost outline to stand in, checklist sheet. */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import type { StretchSpec } from '../../core/types';
import { FadeIn } from '../components/Screen';
import { Icon } from '../components/Icon';
import { Txt } from '../Txt';
import { color, layout, radius } from '../theme';
import { framingDetail, orientationLabel } from './display';
import type { SetupUI } from './useSessionEngine';

type ItemState = 'done' | 'active' | 'pending';

function Item({ label, state }: { label: string; state: ItemState }) {
  return (
    <View style={styles.item} accessible accessibilityLabel={`${label}: ${state === 'done' ? 'done' : state === 'active' ? 'needs attention' : 'waiting'}`}>
      {state === 'done' && (
        <View style={[styles.dot, { backgroundColor: color.moss }]}>
          <Icon name="check" size={14} strokeWidth={3} color="paper" />
        </View>
      )}
      {state === 'active' && (
        <View style={[styles.dot, { backgroundColor: color.ember }]}>
          <Icon name="minus" size={14} strokeWidth={3} color="ink" />
        </View>
      )}
      {state === 'pending' && <View style={styles.pending} />}
      <Txt variant={state === 'active' ? 'bodySemi' : 'body'} color={state === 'pending' ? 'muted' : 'ink'} style={styles.flex}>
        {label}
      </Txt>
    </View>
  );
}

function SetupHeadlineImpl({ setup, calibrating }: { setup: SetupUI; calibrating: boolean }) {
  const title = setup.hint ?? (calibrating ? 'Stand tall' : 'Looking good');
  return (
    <FadeIn key={title} style={styles.headline}>
      <Txt variant="h2" color="cameraInk" align="center" accessibilityLiveRegion="polite" accessibilityRole="header">
        {title}
      </Txt>
      <Txt color="cameraMuted" align="center">
        {framingDetail(setup.hint)}
      </Txt>
    </FadeIn>
  );
}

function SetupSheetImpl({ setup, spec, calibrating, bottom }: { setup: SetupUI; spec: StretchSpec | null; calibrating: boolean; bottom: number }) {
  const f = setup.framing;
  const body: ItemState = f?.wholeBody ? 'done' : 'active';
  const light: ItemState = !f ? 'pending' : f.light ? 'done' : f.wholeBody ? 'active' : 'pending';
  // calibration happens standing (any orientation); the stretch's orientation is checked after
  const orient: ItemState = calibrating ? 'pending' : f?.orientation ? 'done' : f?.wholeBody ? 'active' : 'pending';
  const cal: ItemState = setup.calibrated ? 'done' : calibrating && f?.wholeBody ? 'active' : 'pending';
  const calLabel = setup.calibrated
    ? 'Floor calibrated'
    : setup.calProgress > 0
      ? `Stand still… ${Math.round(setup.calProgress * 100)}%`
      : 'Stand still 2 s to calibrate the floor';

  return (
    <View style={[styles.sheet, { bottom }]}>
      <View style={styles.items}>
        <Item label="Whole body in frame" state={body} />
        <Item label="Light is good" state={light} />
        {spec && <Item label={orientationLabel(spec)} state={orient} />}
        <Item label={calLabel} state={cal} />
      </View>
      <Txt variant="small" color="muted">
        Video stays on this phone. Only angles are saved.
      </Txt>
    </View>
  );
}

/** Dashed ghost outline to stand in (shown until a person is detected). */
function GhostOutlineImpl({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill} pointerEvents="none">
      <G fill="none" stroke={color.cameraInk} strokeWidth={2} strokeDasharray="7 6" opacity={0.55} strokeLinecap="round">
        <Circle cx={200} cy={232} r={24} />
        <Path d="M200 258 C190 300 188 350 192 404" />
        <Path d="M192 404 C196 470 196 530 198 594" />
        <Path d="M194 300 C208 340 214 370 212 400" />
        <Path d="M184 596 H226" />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headline: { gap: 4, paddingHorizontal: layout.gutter },
  sheet: {
    position: 'absolute',
    left: layout.sheetInset,
    right: layout.sheetInset,
    padding: 20,
    gap: 14,
    borderRadius: radius.xxl,
    backgroundColor: color.stone,
  },
  items: { gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pending: { width: 20, height: 20, margin: 2, borderRadius: 10, borderWidth: 2, borderColor: color.pending },
});

/** memoized: the session screen re-renders on phase / live changes, not per frame */
export const SetupHeadline = memo(SetupHeadlineImpl);
export const SetupSheet = memo(SetupSheetImpl);
export const GhostOutline = memo(GhostOutlineImpl);

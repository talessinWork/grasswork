/** Verified hold (Hold artboard): ring with breath glow + rule chips on top, depth meter / It hurts / mute sheet at the bottom. */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { EvalResult, StretchSpec } from '../../core/types';
import type { HoldState } from '../../core/session/holdVerifier';
import { DepthMeter } from '../components/DepthMeter';
import { HoldRing } from '../components/HoldRing';
import { IconButton } from '../components/IconButton';
import { RuleChip } from '../components/Pill';
import { PrimaryButton } from '../components/PrimaryButton';
import { Txt } from '../Txt';
import { color, layout, radius } from '../theme';
import { depthFraction, depthRangeLabel, ruleLabel } from './display';

function ringCaption(hold: HoldState | null): string | undefined {
  switch (hold?.phase) {
    case undefined:
    case 'await_standing':
      return 'stand up, then sink in';
    case 'await_entry':
      return 'get into position';
    case 'paused':
      return 'paused · find it again';
    default:
      return undefined;
  }
}

function HoldTopImpl({ spec, holdS, result, hold, cue }: { spec: StretchSpec; holdS: number; result: EvalResult | null; hold: HoldState | null; cue: string | null }) {
  const live = hold?.phase === 'holding' && !!result?.valid;
  return (
    <View style={styles.top}>
      <HoldRing
        progress={hold?.progress ?? 0}
        heldS={(hold?.heldMs ?? 0) / 1000}
        targetS={holdS}
        live={live}
        caption={ringCaption(hold)}
      />
      <View style={styles.chips}>
        {spec.rules.map((r) => (
          <RuleChip key={r.id} camera label={ruleLabel(r)} met={!!result?.visible && !result.failed.includes(r.id)} />
        ))}
      </View>
      {cue && !result?.valid ? (
        <Txt variant="bodySemi" color="jointBad" align="center" accessibilityLiveRegion="polite">
          {cue}
        </Txt>
      ) : null}
    </View>
  );
}

interface SheetProps {
  spec: StretchSpec;
  result: EvalResult | null;
  hold: HoldState | null;
  /** best depth so far in this session for this stretch */
  sessionBest: number | null;
  muted: boolean;
  voiceOn: boolean;
  onHurt(): void;
  onMute(): void;
  bottom: number;
}

function HoldSheetImpl({ spec, result, hold, sessionBest, muted, voiceOn, onHurt, onMute, bottom }: SheetProps) {
  const better = (a: number, b: number) => (spec.depthBetter === 'higher' ? a > b : a < b);
  let best: number | null = sessionBest;
  if (hold?.bestDepth != null && (best == null || better(hold.bestDepth, best))) best = hold.bestDepth;
  const depth = result?.depth ?? null;
  const beyond = depth != null && best != null && sessionBest != null && better(depth, sessionBest);
  const caption =
    best == null
      ? 'Sink in slowly. The orange mark will show your best.'
      : beyond
        ? 'Deeper than your best (orange mark) right now'
        : 'Orange mark: your best depth today';

  return (
    <View style={[styles.sheet, { bottom }]}>
      <DepthMeter value={depthFraction(spec, depth)} best={best != null ? depthFraction(spec, best) : null} rangeLabel={depthRangeLabel(spec)} caption={caption} />
      <View style={styles.actions}>
        <PrimaryButton
          variant="secondary"
          label="It hurts"
          onPress={onHurt}
          accessibilityHint="Ends this stretch and skips it for today"
          style={styles.hurt}
        />
        {voiceOn && <IconButton tone="paper" size={52} icon={muted ? 'speakerOff' : 'speaker'} label={muted ? 'Unmute voice cues' : 'Mute voice cues'} onPress={onMute} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, paddingHorizontal: layout.gutter },
  sheet: {
    position: 'absolute',
    left: layout.sheetInset,
    right: layout.sheetInset,
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 14,
    borderRadius: radius.xxl,
    backgroundColor: color.stone,
  },
  actions: { flexDirection: 'row', gap: 10 },
  hurt: { flex: 1, minHeight: 52 },
});

/** memoized: the session screen re-renders on phase / live changes, not per frame */
export const HoldTop = memo(HoldTopImpl);
export const HoldSheet = memo(HoldSheetImpl);

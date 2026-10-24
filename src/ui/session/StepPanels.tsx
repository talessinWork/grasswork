/** Instructions before a hold, the rest screen (previewing the next pose), and the pause sheet. */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { getSpec } from '../../core/evaluator/specs/index';
import type { SessionStep } from '../../core/session/sessionMachine';
import type { StretchSpec } from '../../core/types';
import { PrimaryButton } from '../components/PrimaryButton';
import { FadeIn } from '../components/Screen';
import { Silhouette } from '../components/Silhouette';
import { mmss } from '../format';
import { Txt } from '../Txt';
import { color, layout, radius } from '../theme';
import { silhouetteFor } from './display';

function stepLine(step: SessionStep, spec: StretchSpec, sets: number): string {
  const parts = [`${step.holdS} s`];
  if (sets > 1) parts.push(`set ${step.set} of ${sets}`);
  if (step.side) parts.push(`${step.side} side`);
  return parts.join(' · ');
}

export function InstructionsSheet({ step, spec, sets, onReady, onSkip, bottom }: { step: SessionStep; spec: StretchSpec; sets: number; onReady(): void; onSkip(): void; bottom: number }) {
  return (
    <FadeIn style={[styles.sheet, { bottom }]}>
      <View style={styles.row}>
        <Silhouette kind={silhouetteFor(spec.id)} size={72} />
        <View style={styles.flex}>
          <Txt variant="title" accessibilityRole="header">
            {spec.name}
          </Txt>
          <Txt variant="small" color="muted">
            {stepLine(step, spec, sets)}
          </Txt>
        </View>
      </View>
      <Txt>{spec.instructions}</Txt>
      <PrimaryButton label="I'm in position" onPress={onReady} />
      <PrimaryButton variant="secondary" label="Skip this one" onPress={onSkip} />
    </FadeIn>
  );
}

export function RestPanel({ top, restUntil, next, onSkip, bottom }: { top: number; restUntil: number | null; next: SessionStep | null; onSkip(): void; bottom: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const left = restUntil ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0;
  const nextSpec = next ? getSpec(next.stretchId) : null;
  return (
    <>
      <FadeIn style={[styles.restTop, { top }]}>
        <Txt variant="eyebrow" color="cameraMuted" align="center">
          Rest
        </Txt>
        <Txt variant="hero" color="cameraInk" align="center" accessibilityLabel={`${left} seconds of rest left`} style={styles.tabular}>
          {mmss(left)}
        </Txt>
        <Txt color="cameraMuted" align="center">
          Shake it out. Breathe.
        </Txt>
      </FadeIn>
      {nextSpec && next && (
        <FadeIn style={[styles.sheet, { bottom }]}>
          <View style={styles.row}>
            <Silhouette kind={silhouetteFor(nextSpec.id)} size={72} ink={color.ghost} floor={color.pending} />
            <View style={styles.flex}>
              <Txt variant="eyebrow" color="muted">
                Up next
              </Txt>
              <Txt variant="lead">{nextSpec.name}</Txt>
              <Txt variant="small" color="muted">
                {next.side ? `${next.side} side · ` : ''}
                {next.holdS} s
              </Txt>
            </View>
          </View>
          <PrimaryButton variant="secondary" label="Skip rest" onPress={onSkip} />
        </FadeIn>
      )}
    </>
  );
}

export function PauseSheet({ onResume, onSkip, onEnd, bottom }: { onResume(): void; onSkip(): void; onEnd(): void; bottom: number }) {
  return (
    <View style={styles.scrim} accessibilityViewIsModal>
      <FadeIn style={[styles.sheet, { bottom }]}>
        <Txt variant="title" accessibilityRole="header">
          Paused
        </Txt>
        <Txt color="muted">Gus is holding your spot. Held seconds are kept.</Txt>
        <PrimaryButton label="Resume" icon="play" onPress={onResume} />
        <PrimaryButton variant="secondary" label="Skip this stretch" onPress={onSkip} />
        <PrimaryButton variant="secondary" label="End session" onPress={onEnd} />
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tabular: { fontVariant: ['tabular-nums'] },
  restTop: { position: 'absolute', left: 0, right: 0, gap: 4, paddingHorizontal: layout.gutter },
  sheet: {
    position: 'absolute',
    left: layout.sheetInset,
    right: layout.sheetInset,
    padding: 20,
    gap: 14,
    borderRadius: radius.xxl,
    backgroundColor: color.stone,
  },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: color.cameraScrim },
});

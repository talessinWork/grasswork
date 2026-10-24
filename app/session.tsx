/**
 * The whole camera session as one screen, driven by reduceSession (via useSessionEngine):
 * calibrating → framing → instructions → holding → rest → summary.
 * Camera permission is asked here, the first time it is needed, with a friendly explainer.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraDevice, useCameraPermission, type CameraDevice } from 'react-native-vision-camera';
import { poseModelAvailable } from '../src/native/pose';
import { Gus } from '../src/ui/components/Gus';
import { IconButton } from '../src/ui/components/IconButton';
import { Pill } from '../src/ui/components/Pill';
import { PrimaryButton } from '../src/ui/components/PrimaryButton';
import { Screen } from '../src/ui/components/Screen';
import { Skeleton } from '../src/ui/components/Skeleton';
import { parseKind } from '../src/ui/links';
import { HoldSheet, HoldTop } from '../src/ui/session/HoldPanel';
import { CameraFeed, MockFeed } from '../src/ui/session/PoseSource';
import { GhostOutline, SetupHeadline, SetupSheet } from '../src/ui/session/SetupPanel';
import { InstructionsSheet, PauseSheet, RestPanel } from '../src/ui/session/StepPanels';
import { SummaryView } from '../src/ui/session/SummaryView';
import { useLatestFrame } from '../src/ui/session/frameStore';
import { useSessionEngine } from '../src/ui/session/useSessionEngine';
import { Txt } from '../src/ui/Txt';
import { color, layout } from '../src/ui/theme';
import type { SessionKind } from '../src/core/types';

export default function SessionScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = parseKind(params.kind);
  const router = useRouter();
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [asked, setAsked] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // simulator / dev builds without a camera or without the pose model run on the mock stream
  const useMock = __DEV__ && (!device || !poseModelAvailable());

  if (!useMock && !device) {
    return (
      <Explainer
        title="No camera found"
        body="Gus needs a camera to verify your holds. Try again on a phone."
        action="Close"
        onAction={close}
      />
    );
  }
  if (!useMock && !hasPermission) {
    return (
      <Explainer
        title="Let Gus watch your form"
        body="The camera checks each hold so only real stretches count. Video never leaves your phone; only angles are saved."
        action={asked ? 'Open settings to allow camera' : 'Allow camera'}
        onAction={async () => {
          const ok = await requestPermission();
          setAsked(true);
          if (!ok && asked) Linking.openSettings().catch(() => {});
        }}
        onClose={close}
      />
    );
  }

  return <SessionRun kind={kind} device={useMock ? null : (device ?? null)} onClose={close} />;
}

function Explainer({ title, body, action, onAction, onClose }: { title: string; body: string; action: string; onAction(): void; onClose?(): void }) {
  return (
    <Screen
      top={40}
      gap={20}
      bottomInset
      footer={
        <>
          <PrimaryButton label={action} onPress={onAction} />
          {onClose && <PrimaryButton variant="secondary" label="Not now" onPress={onClose} />}
        </>
      }
    >
      <View style={styles.explainer}>
        <Gus mood="waiting" size={120} />
        <Txt variant="h1" align="center" accessibilityRole="header">
          {title}
        </Txt>
        <Txt color="muted" align="center">
          {body}
        </Txt>
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function SessionRun({ kind, device, onClose }: { kind: SessionKind; device: CameraDevice | null; onClose(): void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const engine = useSessionEngine(kind);
  const { status, phase, step, spec, session, setup, live, actions, paused } = engine;
  const frame = useLatestFrame(engine.frames);
  const sheetBottom = Math.max(insets.bottom, 16) + 16;

  // Android back = pause during a session
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (status === 'running') {
        actions.setPaused(true);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [status, actions]);

  const closedRef = useRef(false);
  useEffect(() => {
    if (status === 'closed' && !closedRef.current) {
      closedRef.current = true;
      onClose();
    }
  }, [status, onClose]);

  if (status === 'summary' && engine.summary) {
    const vm = engine.summary;
    return (
      <SummaryView
        vm={vm}
        onDone={() => {
          if (vm.rankUps.length > 0) {
            router.replace({ pathname: '/rank-up', params: { ranks: JSON.stringify(vm.rankUps) } });
          } else onClose();
        }}
      />
    );
  }

  if (status === 'error') {
    return <Explainer title="Something went sideways" body={engine.error?.message ?? 'Unknown error'} action="Close" onAction={onClose} />;
  }

  const setupPhase = phase === 'calibrating' || phase === 'framing';
  const stepCount = session?.steps.length ?? 0;
  const sets = spec && session ? (session.plan.items[step?.itemIndex ?? 0]?.sets ?? 1) : 1;
  const holding = phase === 'holding';
  const personVisible = !!frame?.landmarks;

  return (
    <View style={styles.root}>
      {device ? (
        <CameraFeed device={device} active={status === 'running' && !paused} onFrame={engine.onFrame} />
      ) : (
        status === 'running' && !paused && <MockFeed stretchId={step?.stretchId ?? null} holdS={step?.holdS ?? 30} onFrame={engine.onFrame} />
      )}
      {!device && <View style={styles.mockFloor} />}

      {setupPhase && !personVisible && <GhostOutline width={width} height={height} />}
      <Skeleton
        frame={frame}
        valid={holding ? !!live.result?.valid : !!setup.framing?.ok}
        floorY={engine.calibration?.floorY ?? null}
        width={width}
        height={height}
        mirror={!!device}
        visible={phase !== 'rest'}
      />

      {/* top bar */}
      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        {holding || phase === 'instructions' || phase === 'rest' ? (
          <IconButton icon="pause" label="Pause session" onPress={() => actions.setPaused(true)} />
        ) : (
          <IconButton icon="close" label="Close session" onPress={actions.end} />
        )}
        <Pill
          tone="glass"
          label={
            setupPhase || !spec
              ? `Set up · ${Math.min(stepCount, (session?.stepIndex ?? 0) + 1)} of ${stepCount}`
              : `${spec.name}${step?.side ? ` · ${step.side}` : ''}`
          }
          style={styles.titlePill}
        />
        <View style={styles.spacer} />
      </View>

      {/* phase content */}
      <View style={[styles.upper, { top: insets.top + 84 }]} pointerEvents="box-none">
        {setupPhase && <SetupHeadline setup={setup} calibrating={phase === 'calibrating'} />}
        {holding && spec && step && <HoldTop spec={spec} holdS={step.holdS} result={live.result} hold={live.hold} cue={live.cue} />}
      </View>
      {phase === 'rest' && (
        <RestPanel top={insets.top + 84} restUntil={session?.restUntil ?? null} next={engine.nextStep} onSkip={actions.skip} bottom={sheetBottom} />
      )}

      {setupPhase && <SetupSheet setup={setup} spec={spec} calibrating={phase === 'calibrating'} bottom={sheetBottom} />}
      {phase === 'instructions' && spec && step && (
        <InstructionsSheet step={step} spec={spec} sets={sets} onReady={actions.startHold} onSkip={actions.skip} bottom={sheetBottom} />
      )}
      {holding && spec && (
        <HoldSheet
          spec={spec}
          result={live.result}
          hold={live.hold}
          sessionBest={engine.sessionBest}
          muted={engine.muted}
          voiceOn={engine.voiceOn}
          onHurt={actions.hurt}
          onMute={actions.toggleMute}
          bottom={sheetBottom}
        />
      )}

      {status === 'loading' || status === 'finishing' ? (
        <View style={styles.scrim}>
          <Txt variant="lead" color="cameraInk">
            {status === 'loading' ? 'Gus is setting up…' : 'Saving your holds…'}
          </Txt>
        </View>
      ) : null}

      {paused && (
        <PauseSheet
          onResume={() => actions.setPaused(false)}
          onSkip={actions.skip}
          onEnd={actions.end}
          bottom={sheetBottom}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.camera, overflow: 'hidden' },
  mockFloor: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '30%', backgroundColor: color.cameraFloor },
  topBar: {
    position: 'absolute',
    left: layout.gutter,
    right: layout.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titlePill: { alignSelf: 'center', maxWidth: '70%' },
  spacer: { width: 44 },
  upper: { position: 'absolute', left: 0, right: 0 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: color.cameraScrim, alignItems: 'center', justifyContent: 'center' },
  explainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
});

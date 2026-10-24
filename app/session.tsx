/**
 * The whole camera session as one screen, driven by reduceSession (via useSessionEngine):
 * calibrating → framing → instructions → holding → rest → summary.
 * Camera permission is asked here, the first time it is needed, with a friendly explainer.
 *
 * Render budget: pose frames arrive ~15×/s. Only <SkeletonLayer> subscribes to them; everything else here
 * re-renders when the engine's phase / setup / live snapshots change (which it throttles to visible changes).
 */
import { useKeepAwake } from 'expo-keep-awake';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Linking, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraDevice, useCameraPermission, type CameraDevice } from 'react-native-vision-camera';
import { poseBridgeError, poseModelAvailable } from '../src/native/pose';
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
import { useLatestFrame, type FrameStore } from '../src/ui/session/frameStore';
import { useSessionEngine } from '../src/ui/session/useSessionEngine';
import { useUpsideDownCheck } from '../src/ui/session/useUpsideDownCheck';
import { markSessionMounted } from '../src/ui/sessionActive';
import { useSettings } from '../src/ui/ServicesProvider';
import { Txt } from '../src/ui/Txt';
import { color, layout } from '../src/ui/theme';
import type { SessionKind } from '../src/core/types';

/** Bridge errors that mean the .task model isn't in the binary (see the native plugins' initError strings). */
function isMissingModelError(msg: string | null): boolean {
  return !!msg && /\.task not found|not found in (app bundle|APK assets)|model not found/i.test(msg);
}

const MISSING_MODEL_BODY =
  "This build doesn't include Gus's pose model, so holds can't be verified. " +
  'Reinstall the latest version of Grasswork. (Developers: run `npm run models`, then prebuild and rebuild.)';

export default function SessionScreen() {
  // the phone sits on the floor untouched for minutes; don't let it sleep mid-hold
  useKeepAwake();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = parseKind(params.kind);
  const router = useRouter();
  const { settings } = useSettings();
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [asked, setAsked] = useState(false);

  // keep reminder banners off the camera while this screen is up (read by the root notification handler)
  useEffect(() => markSessionMounted(), []);

  const close = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/')), [router]);

  const modelOk = useMemo(() => poseModelAvailable() && !isMissingModelError(poseBridgeError()), []);
  // simulator / dev builds without a camera or without the pose model run on the mock stream
  const useMock = __DEV__ && (!device || !modelOk);

  // cold-start deep link / notification tap before onboarding: no camera, no session
  if (!settings?.onboarded) return <Redirect href="/onboarding/goals" />;

  if (!__DEV__ && !modelOk) {
    return <Explainer title="Gus can't see yet" body={MISSING_MODEL_BODY} action="Close" onAction={close} />;
  }
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

/**
 * The only component that re-renders at camera rate: skeleton + "stand here" ghost (which depends on whether
 * a person is currently in frame). Memoized so SessionRun's re-renders with equal props don't touch it.
 */
const SkeletonLayer = memo(function SkeletonLayer({
  frames,
  setupPhase,
  valid,
  floorY,
  width,
  height,
  mirror,
  visible,
}: {
  frames: FrameStore;
  setupPhase: boolean;
  valid: boolean;
  floorY: number | null;
  width: number;
  height: number;
  mirror: boolean;
  visible: boolean;
}) {
  const frame = useLatestFrame(frames);
  const personVisible = !!frame?.landmarks;
  return (
    <>
      {setupPhase && !personVisible && <GhostOutline width={width} height={height} />}
      <Skeleton frame={frame} valid={valid} floorY={floorY} width={width} height={height} mirror={mirror} visible={visible} />
    </>
  );
});

/** true while the app is in the foreground ('active') */
function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/** true while this screen is the focused route */
function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}

/**
 * Release builds: the native bridge reports a missing model only once frames reach it (e.g. a model that
 * isModelBundled() saw but MediaPipe couldn't open). Poll the bridge error cheaply instead of hanging on
 * "Step into the frame" forever.
 */
function useMissingModelAtRuntime(enabled: boolean): boolean {
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!enabled || missing) return;
    const id = setInterval(() => {
      if (isMissingModelError(poseBridgeError())) setMissing(true);
    }, 1000);
    return () => clearInterval(id);
  }, [enabled, missing]);
  return missing;
}

function SessionRun({ kind, device, onClose }: { kind: SessionKind; device: CameraDevice | null; onClose(): void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const engine = useSessionEngine(kind);
  const { status, phase, step, spec, session, setup, live, actions, paused } = engine;
  const sheetBottom = Math.max(insets.bottom, 16) + 16;
  const focused = useScreenFocused();
  const appActive = useAppActive();
  // Android only releases the camera when isActive goes false
  const cameraActive = focused && appActive && !paused && status === 'running';
  const modelMissing = useMissingModelAtRuntime(!__DEV__ && !!device && status === 'running');
  const upsideDown = useUpsideDownCheck(engine.frames, __DEV__ && status === 'running');
  const resume = useCallback(() => actions.setPaused(false), [actions]);

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
  if (modelMissing) {
    return <Explainer title="Gus can't see yet" body={MISSING_MODEL_BODY} action="Close" onAction={actions.end} />;
  }

  const setupPhase = phase === 'calibrating' || phase === 'framing';
  const stepCount = session?.steps.length ?? 0;
  const sets = spec && session ? (session.plan.items[step?.itemIndex ?? 0]?.sets ?? 1) : 1;
  const holding = phase === 'holding';

  return (
    <View style={styles.root}>
      {device ? (
        <CameraFeed device={device} active={cameraActive} onFrame={engine.onFrame} />
      ) : (
        cameraActive && <MockFeed stretchId={step?.stretchId ?? null} holdS={step?.holdS ?? 30} onFrame={engine.onFrame} />
      )}
      {!device && <View style={styles.mockFloor} />}

      <SkeletonLayer
        frames={engine.frames}
        setupPhase={setupPhase}
        valid={holding ? !!live.result?.valid : !!setup.framing?.ok}
        floorY={engine.calibration?.floorY ?? null}
        width={width}
        height={height}
        mirror={!!device}
        visible={phase !== 'rest'}
      />

      {__DEV__ && upsideDown && (
        <View style={[styles.devBanner, { top: insets.top + 64 }]} pointerEvents="none">
          <Txt variant="small" color="cameraInk" align="center">
            Pose looks upside down — check orientation in the native plugin
          </Txt>
        </View>
      )}

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
          onResume={resume}
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
  devBanner: {
    position: 'absolute',
    left: layout.gutter,
    right: layout.gutter,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(180, 40, 40, 0.85)',
  },
});

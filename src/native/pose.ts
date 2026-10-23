/**
 * Camera -> MediaPipe Pose Landmarker bridge (contract F).
 *
 *   const fp = usePoseFrameProcessor((f) => smoother.smooth(f), { model: 'lite', fps: 15 });
 *   <Camera device={device} isActive frameProcessor={fp} pixelFormat="rgb" />
 *
 * The heavy lifting happens in the native VisionCamera plugin `detectPose`
 * (modules/pose-landmarker). This file only throttles, normalizes the result into a
 * PoseFrame and hops it to the JS thread.
 *
 * Coordinates handed to `onFrame` are always in the NON-mirrored upright image (what a third
 * person filming you would see), with anatomical left/right labels. If you draw an overlay on a
 * mirrored front-camera preview, flip x (x -> 1 - x) when drawing, not before evaluating.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import {
  VisionCameraProxy,
  runAtTargetFps,
  useFrameProcessor,
  type Frame,
  type FrameProcessorPlugin,
  type ReadonlyFrameProcessor,
} from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { installPosePlugin, isModelBundled, type PoseModel } from '../../modules/pose-landmarker';
import type { Landmark, PoseFrame } from '../core/types';
import { POSE_LANDMARK_COUNT } from '../core/types';

export type { PoseModel };

export interface PoseFrameProcessorOptions {
  model?: PoseModel;
  /** target detection rate; frames in between are dropped before reaching MediaPipe */
  fps?: number;
}

/** Raw dictionary returned by the native plugin (see modules/pose-landmarker/index.ts NativePoseResult). */
interface RawResult {
  landmarks?: Landmark[] | null;
  aspect?: number;
  t?: number;
  mirrored?: boolean;
  error?: string;
}

/** left<->right partner index of each of the 33 MediaPipe landmarks (nose 0 maps to itself). */
const MIRROR_PARTNER: number[] = [
  0, 4, 5, 6, 1, 2, 3, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15, 18, 17, 20, 19, 22, 21, 24, 23, 26, 25, 28, 27, 30, 29, 32,
  31,
];

// ---------------------------------------------------------------------------------------------
// Plugin initialisation (JS thread, once per model)
// ---------------------------------------------------------------------------------------------

const plugins: Partial<Record<PoseModel, FrameProcessorPlugin | null>> = {};
let lastInitError: string | null = null;

function getPlugin(model: PoseModel): FrameProcessorPlugin | null {
  const cached = plugins[model];
  if (cached !== undefined) return cached;
  let plugin: FrameProcessorPlugin | null = null;
  try {
    // Android registers `detectPose` from Application.onCreate; this is a fallback that also
    // tells us whether the native module is linked at all (false in Expo Go / web).
    installPosePlugin();
    plugin = VisionCameraProxy.initFrameProcessorPlugin('detectPose', { model }) ?? null;
    if (!plugin) lastInitError = `VisionCamera plugin "detectPose" is not registered (${Platform.OS})`;
  } catch (e) {
    lastInitError = e instanceof Error ? e.message : String(e);
    plugin = null;
  }
  plugins[model] = plugin;
  if (plugin && __DEV__ && !isModelBundled(model)) {
    console.warn(`[pose] pose_landmarker_${model}.task is not bundled; run modules/pose-landmarker/scripts/download-models.sh and prebuild`);
  }
  return plugin;
}

/**
 * True when the `detectPose` plugin initialised and the lite model is bundled, i.e. real pose
 * detection can run. False on the iOS Simulator only if the binary lacks the module — in that
 * case (or when you just want deterministic frames) use createMockPoseStream from ./mockPose.
 */
export function poseModelAvailable(model: PoseModel = 'lite'): boolean {
  return getPlugin(model) != null && isModelBundled(model);
}

/** Last init error, for a debug overlay. Not part of the contract. */
export function poseBridgeError(): string | null {
  return lastInitError;
}

// ---------------------------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------------------------

export function usePoseFrameProcessor(
  onFrame: (f: PoseFrame) => void,
  opts?: PoseFrameProcessorOptions,
): ReadonlyFrameProcessor {
  const model: PoseModel = opts?.model ?? 'lite';
  const fps = opts?.fps ?? 15;

  // Keep the latest callback without re-creating the frame processor on every render.
  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  const plugin = useMemo(() => getPlugin(model), [model]);

  const deliver = useMemo(
    () =>
      Worklets.createRunOnJS((f: PoseFrame) => {
        onFrameRef.current(f);
      }),
    [],
  );

  const reportError = useMemo(
    () =>
      Worklets.createRunOnJS((msg: string) => {
        if (msg !== lastInitError) {
          lastInitError = msg;
          if (__DEV__) console.warn(`[pose] ${msg}`);
        }
      }),
    [],
  );

  return useFrameProcessor(
    (frame: Frame) => {
      'worklet';
      if (plugin == null) return;
      runAtTargetFps(fps, () => {
        'worklet';
        const raw = plugin.call(frame, { model }) as unknown as RawResult | undefined;
        if (raw == null) return;
        if (raw.error != null) reportError(raw.error);

        // Native already hands us a strictly increasing ms timestamp; fall back to frame.timestamp
        // (ns on Android, and on iOS depending on VisionCamera version — values > 1e13 are ns).
        let t: number;
        if (typeof raw.t === 'number') {
          t = raw.t;
        } else {
          const ts = frame.timestamp;
          t = ts > 1e13 ? ts / 1e6 : ts;
        }

        const aspect =
          typeof raw.aspect === 'number' && raw.aspect > 0
            ? raw.aspect
            : frame.orientation === 'portrait' || frame.orientation === 'portrait-upside-down'
              ? frame.height / frame.width
              : frame.width / frame.height;

        let landmarks: Landmark[] | null = null;
        const src = raw.landmarks;
        if (src != null && src.length >= POSE_LANDMARK_COUNT) {
          const out: Landmark[] = new Array(POSE_LANDMARK_COUNT);
          const mirrored = raw.mirrored === true;
          for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
            const p = src[i];
            const lm: Landmark = {
              x: mirrored ? 1 - p.x : p.x,
              y: p.y,
              z: p.z,
              visibility: p.visibility ?? 0,
            };
            // A mirrored image makes MediaPipe label your left side as "right": swap back.
            out[mirrored ? MIRROR_PARTNER[i] : i] = lm;
          }
          landmarks = out;
        }

        deliver({ t, landmarks, aspect });
      });
    },
    [plugin, model, fps, deliver, reportError],
  );
}

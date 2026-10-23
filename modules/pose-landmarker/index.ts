/**
 * JS face of the `pose-landmarker` Expo local module.
 *
 * The heavy lifting happens in the VisionCamera frame-processor plugin `detectPose`
 * (see ios/PoseLandmarkerFrameProcessorPlugin.swift and android/.../PoseLandmarkerFrameProcessorPlugin.kt).
 * This Expo module only offers two small synchronous helpers:
 *   - install(): makes sure the `detectPose` plugin is registered with VisionCamera
 *     (Android registers here; iOS registers at +load time, so it is a no-op there).
 *   - isModelBundled(model): whether pose_landmarker_<model>.task was copied into the app at prebuild.
 *
 * Use src/native/pose.ts from app code, not this file directly.
 */
import { requireOptionalNativeModule } from 'expo';

export type PoseModel = 'lite' | 'full';

/** The shape the native `detectPose` plugin returns for one frame. */
export interface NativePoseResult {
  /** 33 MediaPipe landmarks, normalized to the upright (oriented) image, origin top-left; null when no person. */
  landmarks: { x: number; y: number; z: number; visibility: number }[] | null;
  /** width / height of the oriented image the landmarks are normalized to. */
  aspect: number;
  /** strictly increasing ms timestamp that was handed to MediaPipe for this frame. */
  t: number;
  /** true when the pixels MediaPipe saw were horizontally mirrored (iOS front camera). */
  mirrored: boolean;
}

interface PoseLandmarkerNativeModule {
  install(): boolean;
  isModelBundled(model: string): boolean;
}

const native = requireOptionalNativeModule<PoseLandmarkerNativeModule>('PoseLandmarker');

/** True when the native module is linked into this binary (false in Expo Go / web / tests). */
export function isNativeModuleLinked(): boolean {
  return native != null;
}

/** Registers the `detectPose` frame-processor plugin if it isn't yet. Safe to call repeatedly. */
export function installPosePlugin(): boolean {
  if (!native) return false;
  try {
    return native.install();
  } catch {
    return false;
  }
}

/** Whether pose_landmarker_<model>.task is present in the app bundle / Android assets. */
export function isModelBundled(model: PoseModel): boolean {
  if (!native) return false;
  try {
    return native.isModelBundled(model);
  } catch {
    return false;
  }
}

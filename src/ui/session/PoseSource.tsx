/**
 * Where pose frames come from: the front camera through the native bridge, or (in __DEV__ without a camera
 * or without the native model, e.g. the iOS Simulator) a scripted mock stream shaped like the current stretch.
 */
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Camera, type CameraDevice } from 'react-native-vision-camera';
import { DEEP_SQUAT, FOLD_FLOOR, STANDING } from '../../core/pose/synthetic';
import type { PoseFrame } from '../../core/types';
import { createMockPoseStream } from '../../native/mockPose';
import { usePoseFrameProcessor } from '../../native/pose';
import { silhouetteFor } from './display';

export function CameraFeed({ device, active, onFrame }: { device: CameraDevice; active: boolean; onFrame(f: PoseFrame): void }) {
  const frameProcessor = usePoseFrameProcessor(onFrame, { model: 'lite', fps: 15 });
  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={active}
      frameProcessor={frameProcessor}
      pixelFormat="rgb"
      resizeMode="cover"
      audio={false}
      photo={false}
      video={false}
    />
  );
}

/**
 * Dev-only mock: stand (calibration) → the stretch's pose for the hold → stand through the rest, looping.
 * Restarts when the stretch family changes so folds get a fold and squats a squat.
 */
export function MockFeed({ stretchId, holdS, onFrame }: { stretchId: string | null; holdS: number; onFrame(f: PoseFrame): void }) {
  const family = stretchId ? silhouetteFor(stretchId) : 'squat';
  useEffect(() => {
    const pose = family === 'fold' ? FOLD_FLOOR : DEEP_SQUAT;
    const stream = createMockPoseStream({
      phases: [
        { pose: STANDING, durationMs: 9000, transitionMs: 0 },
        { pose, durationMs: (holdS + 6) * 1000, transitionMs: 1200 },
        { pose: STANDING, durationMs: 16000, transitionMs: 1200 },
      ],
      fps: 15,
      aspect: 9 / 16,
      loop: true,
    });
    stream.start(onFrame);
    return () => stream.stop();
    // onFrame is stable (useCallback in the engine)
  }, [family, holdS, onFrame]);
  return null;
}

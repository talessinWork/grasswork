# src/native: camera → pose bridge

```
<Camera frameProcessor>            (VisionCamera v4, camera thread)
  └─ useFrameProcessor worklet     (react-native-worklets-core)
       └─ runAtTargetFps(15)       drop frames before they reach MediaPipe
            └─ detectPose plugin   (modules/pose-landmarker, Swift / Kotlin, synchronous)
                 └─ MediaPipe PoseLandmarker, VIDEO mode, 1 pose
       └─ map to PoseFrame, un-mirror if needed
       └─ Worklets.createRunOnJS → onFrame(PoseFrame)   (JS thread)
```

## API

```ts
import { usePoseFrameProcessor, poseModelAvailable } from '@/native/pose';
import { createMockPoseStream } from '@/native/mockPose';

const fp = usePoseFrameProcessor((f) => onPose(f), { model: 'lite', fps: 15 });
<Camera device={device} isActive frameProcessor={fp} pixelFormat="rgb" />

if (!poseModelAvailable()) {
  const mock = createMockPoseStream();   // stand 2.5 s → deep squat 45 s → stand 5 s
  mock.start(onPose);                    // ... mock.stop() on unmount
}
```

- `usePoseFrameProcessor(onFrame, { model?: 'lite' | 'full', fps?: 15 })` returns a
  `ReadonlyFrameProcessor`. `onFrame` may change between renders (kept in a ref).
- `poseModelAvailable(model = 'lite')`: the `detectPose` plugin initialised **and** the model file is
  bundled. False in Expo Go, on web, or when the native module isn't in the binary.
- `poseBridgeError()`: last init/detect error string, for a debug overlay.
- `createMockPoseStream(script?)` → `{ start(onFrame), stop() }`; plain `setInterval`, deterministic
  jitter (seeded), custom scripts via `MockPoseScript { phases, fps, aspect, jitter, loop, seed }`.
  `mockPoseAt(script, ms)` gives the un-jittered pose for tests.

## Data contract (`PoseFrame` from src/core/types.ts)

| field | meaning |
| --- | --- |
| `t` | ms, strictly increasing within a session (native clamps; from the frame's presentation timestamp, not wall-clock) |
| `landmarks` | 33 MediaPipe landmarks or `null` (no person / model error) |
| `landmarks[i].x, y` | normalized to the **upright, un-mirrored** image, origin top-left, y down |
| `landmarks[i].z` | MediaPipe depth relative to the hips (roughly x-scale); rarely useful |
| `landmarks[i].visibility` | 0..1 |
| `aspect` | width / height of the upright image (≈ 0.5625 for a portrait 16:9 camera) |

Left/right labels are **anatomical** (the person's left), as MediaPipe produces them on a
non-mirrored image.

## Pitfalls

**Front camera mirroring.** The preview of the front camera is mirrored (selfie view); the pixels
in the frame may or may not be, depending on platform and VisionCamera version. The native plugin
reports `mirrored`; when true, `pose.ts` maps `x → 1 - x` *and* swaps left/right indices so the
data is always un-mirrored with anatomical labels. Evaluate on that data; only flip x when *drawing*
an overlay on top of a mirrored preview.

**Orientation.** Camera sensors are landscape. The plugin rotates to upright (iOS: `MPImage`
orientation from `frame.orientation`; Android: `ImageProxy.imageInfo.rotationDegrees` then a bitmap
rotate) so landmarks and `aspect` are in the portrait image the user sees. The app is
portrait-locked (`app.json`); if that changes, re-check `aspect` and the skeleton direction.

**Angles need `aspect`.** Normalized x and y have different scales in a non-square image. Always
pass `frame.aspect` to the geometry helpers in `src/core/pose/geometry.ts`.

**Strictly increasing timestamps.** MediaPipe VIDEO mode throws if a timestamp is ≤ the previous
one. The native plugin clamps (`ts = max(ts, last + 1)`) and returns the ts it used as `t`. When the
landmarker is rebuilt (model switch) its clock restarts, which is fine. Don't feed the same
landmarker from two cameras.

**Model files.** Not in git. Run `bash modules/pose-landmarker/scripts/download-models.sh` then
prebuild; the config plugin copies them into the iOS bundle / Android assets (uncompressed). Missing
models show up as `poseBridgeError()` = "...task not found..." and `poseModelAvailable()` = false.

**Simulator.** The iOS Simulator has no camera; use `createMockPoseStream()`. MediaPipe's iOS pod
does ship simulator slices, so the app still builds there.

**Throughput.** `lite` at 15 fps is the default; `full` is more accurate in deep flexion (useful
for the forward fold) but ~2x slower. The callback runs synchronously on the camera thread; frames
that arrive while it's busy are dropped by VisionCamera.

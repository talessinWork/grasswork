# pose-landmarker (Expo local module)

Runs Google MediaPipe **Pose Landmarker** on-device and exposes it as a VisionCamera v4
frame-processor plugin called **`detectPose`**. App code should use `src/native/pose.ts`
(`usePoseFrameProcessor`), not this module directly.

| Platform | Language | MediaPipe dependency | Plugin registration |
| --- | --- | --- | --- |
| iOS | Swift (+ one `.mm` file) | pod `MediaPipeTasksVision ~> 0.10.14` | `VISION_EXPORT_SWIFT_FRAME_PROCESSOR` in `ios/PoseLandmarkerFrameProcessorPlugin.mm` |
| Android | Kotlin | `com.google.mediapipe:tasks-vision:0.10.14` | `FrameProcessorPluginRegistry.addFrameProcessorPlugin("detectPose")` from `PoseLandmarkerPackage` (Application.onCreate), repeated from the Expo module's `OnCreate` and `install()` |

## 1. Download the models (not committed)

```sh
bash modules/pose-landmarker/scripts/download-models.sh      # --force to re-download
```

This puts `pose_landmarker_lite.task` (~5.5 MB) and `pose_landmarker_full.task` (~9 MB) into
`<repo>/assets/models/` (git-ignored). Source:
`https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_{lite,full}/float16/latest/…`

## 2. Prebuild

`app.plugin.js` (add `"./modules/pose-landmarker/app.plugin.js"` to `app.json > expo.plugins`) copies
every `assets/models/*.task` at `expo prebuild`:

- **iOS** → `ios/<AppName>/*.task`, added to the app target's *Copy Bundle Resources*;
  the plugin loads them with `Bundle.main.path(forResource:ofType:)`.
- **Android** → `android/app/src/main/assets/*.task`, plus `androidResources { noCompress 'task' }`
  in `app/build.gradle` (MediaPipe memory-maps the asset; compressed assets fail to open).

Re-run prebuild (or `expo run:*`) after adding/updating models. If the models are missing the plugin
still loads, but every frame returns `{ landmarks: null, error: "…task not found…" }`.

## Plugin contract

```ts
const plugin = VisionCameraProxy.initFrameProcessorPlugin('detectPose', { model: 'lite' }); // or 'full'
const r = plugin.call(frame, { model: 'lite' });
// r = {
//   landmarks: Array(33) of { x, y, z, visibility } | null,  // normalized to the UPRIGHT image, origin top-left
//   aspect: number,      // oriented width / height
//   t: number,           // ms, strictly increasing — the timestamp given to MediaPipe
//   mirrored: boolean,   // the pixels MediaPipe saw were mirrored (src/native/pose.ts un-mirrors)
//   error?: string,      // init/detect failure, landmarks is null then
// }
```

Landmarker options: running mode VIDEO, `numPoses = 1`, min detection / presence / tracking
confidence 0.5, CPU delegate (switch to GPU once everything works). It is created lazily on the
first frame for the requested model and rebuilt if the model argument changes.

JS helpers in `index.ts`: `installPosePlugin()`, `isModelBundled(model)`, `isNativeModuleLinked()`.

## Files

```
app.plugin.js                         config plugin (model copying)
scripts/download-models.sh            fetch models into assets/models/
ios/GrassworkPose.podspec             pod is NOT named PoseLandmarker (would clash with MediaPipe's class)
ios/PoseLandmarkerModule.swift        Expo module "PoseLandmarker" (install / isModelBundled)
ios/PoseLandmarkerFrameProcessorPlugin.swift / .mm
android/build.gradle
android/src/main/java/expo/modules/grassworkpose/
  PoseLandmarkerModule.kt, PoseLandmarkerPackage.kt, PoseLandmarkerFrameProcessorPlugin.kt
```

## First-build checklist (search for `FIRST-BUILD CHECK` in the sources)

1. **Orientation**: hold the phone upright, stand in frame: `nose.y < ankle.y` and
   `aspect ≈ 0.56` (9:16). If the skeleton is rotated, adjust the orientation mapping in the
   plugin (iOS `uprightOrientation`, Android `rotationDegrees`).
2. **Front camera on iOS**: raise your *left* hand; `landmarks[15]` (L_WRIST) must move, and its
   x must be on the right half of the un-mirrored image. If upside down, flip
   `swapRotationWhenMirrored`; if left/right are swapped, `mirrored` is reported wrongly for your
   VisionCamera version.
3. **iOS link errors / "Unregistered type" crash** at landmarker creation: MediaPipeTasksCommon's
   `-force_load` flags didn't reach the app target; check `OTHER_LDFLAGS` of the app target in
   Pods-<App>.xcconfig.
4. **Android CameraX classpath**: the module compiles against `androidx.camera:camera-core`
   (compileOnly); align the version with VisionCamera's if Gradle complains.
5. Use `<Camera pixelFormat="rgb">` on iOS: MediaPipe needs 32BGRA, `yuv` frames get converted
   with Core Image (works but costs ~2 ms per frame).

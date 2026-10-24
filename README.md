# Grasswork

A stretching app that nags you until you do it, watches through the camera to make sure you actually did, and walks you toward long-term goals: a full ass-to-grass squat and palms on the floor in a forward fold.

- **Verified holds.** On-device MediaPipe pose estimation (33 landmarks). The hold timer only runs while your joints pass the stretch's rules. Video never leaves the phone; only angles and durations are stored.
- **Long-term progression.** Each goal is a ladder of variants (Squat: Chair → Bench → Curb → Grass; Fold: Knees → Shins → Ankles → Floor → Palms). A weekly test measures real depth; two passing tests in a row promote you.
- **Pressure.** A five-step escalating reminder ladder from Gus, a grass sprout who wilts as the day goes by. Three tones: polite, sassy, unhinged. A 3-minute rescue session saves the streak late at night.
- **Single user, fully offline.** No backend, no account. Data lives in SQLite on the phone, rides along in the phone's normal backup, and exports as JSON.

## Run it on your phone

You need a Mac with Xcode for iPhone, or Android Studio for Android. A **development build** is required (not Expo Go), because the camera pose plugin is native code.

```sh
npm install
npm run models          # downloads the two MediaPipe .task models into assets/models/
npx expo prebuild       # generates ios/ and android/, bundles the models
npm run ios             # or: npm run android   (builds and installs on a connected device)
```

After the first build, day-to-day JS changes only need `npm start`.

**iOS Simulator** has no camera: in development builds the session screen falls back to a synthetic pose stream (stand → deep squat → stand), so the whole flow can be clicked through.

## First-build checklist

None of the React Native, Expo or native code has been compiled yet. It was written against the APIs of Expo SDK 53, VisionCamera v4 and MediaPipe Tasks 0.10.x. Expect a few fixes on the first build. Check these first:

1. `npx expo install --check` and accept the versions it suggests for SDK 53.
2. `npm run typecheck` once `node_modules` exists. Typed-route errors on `router.push` clear up after the first `expo start` generates `.expo/types`.
3. iOS: `pod install` finds the `GrassworkPose` pod and MediaPipe. Android: autolinking finds `PoseLandmarkerPackage`.
4. On a device, stand in frame with the phone upright: the skeleton should sit on your body, nose above ankles, and raising your left hand should move the left wrist.
5. Search the code for `FIRST-BUILD CHECK` comments; they mark the spots most likely to need adjusting.

More detail: `modules/pose-landmarker/README.md` (models, prebuild, native registration) and `src/native/README.md` (data contract, mirroring and orientation).

## Project layout

```
app/                    Expo Router screens (onboarding, tabs, session, boss, rank-up)
src/ui/                 components, session engine glue, theme tokens
src/services/           AppServices: everything the screens read and write
src/core/
  pose/                 geometry, One Euro smoothing, floor calibration
  evaluator/            metric registry, rule engine, framing checks, stretch specs (JSON)
  session/              hold verifier, session state machine, voice-cue throttle
  progression/          daily plans, weekly tests, promotions
  game/                 XP, levels, streaks, ranks, badges, Gus
  reminders/            nag ladder, message bank, notification scheduler
  db/                   SQLite and in-memory repositories, migrations
src/native/             JS side of the camera pose bridge + simulator mock
modules/pose-landmarker MediaPipe frame-processor plugin (Swift, Kotlin)
CONTRACTS.md            module boundaries and every public signature
```

## Tests

All logic in `src/core` and `src/services` is pure TypeScript with no React Native imports, so it runs without a device:

```sh
npm run typecheck:core  # strict tsc over core + services
npm test                # bun test: 209 tests, incl. multi-day simulated use
```

## Adding a stretch

Stretches are data. Add a JSON spec in `src/core/evaluator/specs/` (camera view, required joints, rules over named metrics, depth metric and target), register it in `specs/index.ts`, and add a test pose in the evaluator tests.

## Safety

Stretch to mild tension, never pain. Every hold has an "It hurts" button: it ends the hold, and the plan swaps in an easier variant for 48 hours. This is not medical or physiotherapy advice.

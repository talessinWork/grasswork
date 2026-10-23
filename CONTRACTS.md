# Grasswork module contracts

Every builder works ONLY inside its own folders and implements EXACTLY the exports listed for it.
Shared types: `src/core/types.ts`, storage interface: `src/core/repo.ts`, helpers: `src/core/util.ts`,
screen API: `src/services/contract.ts`. Do not edit those four files; if a contract is wrong, say so in your final report.

Rules for all `src/core/**` code:
- Pure TypeScript. No React, React Native, Expo or any npm package imports. Only relative imports.
- No `Date.now()` inside logic: take `now: number` (epoch ms) as a parameter so tests are deterministic.
- Tests live next to code as `*.test.ts` and run with `bun test` (Jest-compatible API: `import { describe, it, expect } from 'bun:test'`).
- Must pass `npx tsc -p tsconfig.core.json` (strict) and `bun test src/core`.

Stretch and goal ids are fixed (used by progression, UI and specs):

| Goal | Level ids, easiest first | Rank names (same order) |
| --- | --- | --- |
| `deep_squat` | `squat_chair`, `squat_heels_raised`, `squat_curb`, `deep_squat` | Chair, Bench, Curb, Grass |
| `forward_fold` | `fold_knees`, `fold_shins`, `fold_ankles`, `fold_floor`, `fold_palms` | Knees, Shins, Ankles, Floor, Palms |
| supporting (goalId null) | `couch_stretch` (perSide), `squat_sit` | – |

Other GoalIds (`front_split`, `bridge`, `overhead_reach`, `straddle`) exist in metadata only, marked `available: false` ("coming later").

---

## A · Pose + evaluator — `src/core/pose/`, `src/core/evaluator/`

```ts
// pose/geometry.ts
export function jointPoint(pose: Pose, joint: JointName, side: Side): Landmark;
export function angleDeg(a: Landmark, b: Landmark, c: Landmark, aspect: number): number; // angle at b
export function distance(a: Landmark, b: Landmark, aspect: number): number;
export function pickSide(pose: Pose): Side;                       // side more visible to the camera
export function shoulderWidthRatio(pose: Pose, aspect: number): number; // shoulder width / torso length; small = side-on
export function isSideOn(pose: Pose, aspect: number): boolean;
export function isFrontOn(pose: Pose, aspect: number): boolean;
export function isStanding(pose: Pose, cal: Calibration | null, aspect: number): boolean;

// pose/oneEuro.ts
export class OneEuroFilter { constructor(opts?: { minCutoff?: number; beta?: number; dCutoff?: number }); filter(x: number, tMs: number): number; reset(): void; }
export class PoseSmoother { constructor(opts?: { minCutoff?: number; beta?: number }); smooth(frame: PoseFrame): PoseFrame; reset(): void; }

// pose/calibration.ts — needs ~2 s of standing still, whole body visible
export interface CalibrationProgress { status: 'need_body' | 'hold_still' | 'done'; progress: number; hint: string | null; calibration: Calibration | null; }
export class Calibrator { constructor(opts?: { durationMs?: number; maxJitter?: number }); push(frame: PoseFrame): CalibrationProgress; reset(): void; }

// evaluator/metrics.ts
export const METRICS: Record<MetricId, (pose: Pose, cal: Calibration, aspect: number) => number | null>;

// evaluator/framing.ts — the setup checklist on the framing screen
export interface FramingCheck { wholeBody: boolean; orientation: boolean; light: boolean; ok: boolean; hint: string | null; }
export function checkFraming(frame: PoseFrame, spec: StretchSpec): FramingCheck;

// evaluator/evaluate.ts
export interface Evaluator { evaluate(frame: PoseFrame): EvalResult; reset(): void; }
export function createEvaluator(spec: StretchSpec, cal: Calibration, opts?: { visibilityThreshold?: number }): Evaluator;

// evaluator/specs/index.ts (+ one JSON file per stretch in evaluator/specs/)
export const SPECS: StretchSpec[];
export function getSpec(id: string): StretchSpec;             // throws on unknown id
export function specsForGoal(goalId: GoalId): StretchSpec[];  // sorted by level
export interface GoalMeta { id: GoalId; name: string; ranks: string[]; available: boolean; bossName: string; unit: string; referenceLabel: string; }
export const GOALS: GoalMeta[];
export function getGoal(id: GoalId): GoalMeta;
// display helper: depth metric value -> human text, e.g. "3 cm below knee" (estimate cm from shin ≈ 40 cm)
export function formatDepth(spec: StretchSpec, depth: number): string;
```

## B · Session — `src/core/session/`

```ts
// session/holdVerifier.ts
export type HoldPhase = 'await_standing' | 'await_entry' | 'holding' | 'paused' | 'complete';
export interface HoldState { phase: HoldPhase; heldMs: number; targetMs: number; progress: number; bestDepth: number | null; validFrames: number; totalFrames: number; failedRules: Record<string, number>; enteredFromStanding: boolean; }
export interface HoldVerifier { push(r: EvalResult): HoldState; state(): HoldState; reset(): void; }
export function createHoldVerifier(opts: { targetS: number; depthBetter: 'higher' | 'lower'; startAfterMs?: number /*500*/; dropoutMs?: number /*700*/; requireEntry?: boolean /*true*/ }): HoldVerifier;
export function toAttempt(state: HoldState, meta: { id: string; sessionId: string; stretchId: string; side: Side | null; startedAt: number; endedAt: number; hurt: boolean }): AttemptRecord;

// session/sessionMachine.ts — pure reducer for the session flow
export type SessionPhase = 'calibrating' | 'framing' | 'instructions' | 'holding' | 'rest' | 'summary' | 'aborted';
export interface SessionStep { itemIndex: number; set: number; side: Side | null; stretchId: string; holdS: number; }
export interface SessionState { phase: SessionPhase; plan: DayPlan; steps: SessionStep[]; stepIndex: number; attempts: AttemptRecord[]; restUntil: number | null; startedAt: number; skippedStretchIds: string[]; }
export type SessionEvent =
  | { type: 'CALIBRATED' } | { type: 'FRAMING_OK' } | { type: 'START_HOLD' }
  | { type: 'HOLD_DONE'; attempt: AttemptRecord; now: number }
  | { type: 'HURT'; attempt: AttemptRecord; now: number }   // skips remaining steps of that stretch
  | { type: 'SKIP'; now: number } | { type: 'TICK'; now: number } | { type: 'ABORT' };
export function buildSteps(plan: DayPlan, specLookup: (id: string) => StretchSpec): SessionStep[];
export function initSession(plan: DayPlan, specLookup: (id: string) => StretchSpec, now: number, opts?: { restS?: number /*15*/ }): SessionState;
export function reduceSession(state: SessionState, ev: SessionEvent): SessionState;
export function currentStep(state: SessionState): SessionStep | null;
// framing is re-entered when the next step needs a different camera view than the previous one

// session/cueThrottle.ts
export interface CueThrottle { next(r: EvalResult, now: number): string | null; reset(): void; }
export function createCueThrottle(opts?: { minGapMs?: number /*3000*/; sameCueGapMs?: number /*6000*/ }): CueThrottle;
```

## C · Progression + game — `src/core/progression/`, `src/core/game/`

```ts
// progression/plan.ts
export interface PlanInput { date: LocalDate; kind: SessionKind; now: number; goals: GoalRecord[]; attempts: AttemptRecord[] /*last 28 days*/; sessions: SessionRecord[] /*last 28 days*/; specLookup: (id: string) => StretchSpec; specsForGoal: (g: GoalId) => StretchSpec[]; }
export function buildDayPlan(input: PlanInput): DayPlan;
// daily: each active goal's current variant 2 sets + 1–2 supporting stretches; hold target = spec.defaultHoldS + 5 s per full week since goal start, cap so estimatedS <= 720
// comeback: if >= 2 missed days before today, halve sets/holds once
// hurt: a stretch with hurt=true in the last 48 h is replaced by the next easier level (or dropped if level 0)
// rescue: 1 set per goal, current variant, holdS = min(30, normal), no supporting stretches (~3 min)
// test: 1 set per goal, current variant, holdS 20 (max-depth effort)

// progression/promotion.ts
export interface PromotionResult { promote: boolean; nextStretchId: string | null; plateau: boolean; }
export function evaluatePromotion(goal: GoalRecord, tests: TestResultRecord[], specsForGoal: (g: GoalId) => StretchSpec[]): PromotionResult;
// promote: last TWO consecutive tests on the current stretch reached spec.targetDepth (respect depthBetter)
// plateau: >= 3 tests on current stretch and the last 3 weeks show no improvement over the best before them

// progression/testSchedule.ts
export function isTestDay(date: LocalDate, settings: Settings, sessions: SessionRecord[]): boolean; // weekday match and no test session yet that day
export function weekNumber(firstSessionDate: LocalDate | null, date: LocalDate): number; // 1-based

// game/xp.ts
export function xpForAttempt(a: AttemptRecord, spec: StretchSpec, prevBestDepth: number | null, now: number): XpEvent[]; // 'hold' = round(heldS * depthScore) where depthScore in [0.5, 2]; +40 'personal_best'
export function levelFor(totalXp: number): { level: number; intoLevel: number; forNext: number; total: number }; // level 1 at 0 xp, each level needs 20% more than the last, level 2 at 300

// game/streak.ts
export function dayStatuses(input: { today: LocalDate; doneDates: Set<LocalDate>; frozenDates: Set<LocalDate>; restDates: Set<LocalDate>; from: LocalDate }): Map<LocalDate, DayStatus>;
export function rollStreak(state: StreakState, input: { today: LocalDate; doneDates: Set<LocalDate>; restDates: Set<LocalDate> }): { state: StreakState; frozenDates: LocalDate[] };
// walks every day from state.lastCountedDate+1 up to yesterday: done → +1; rest → counts; missed → spend a freeze if banked (record it in frozenDates) else reset to 0;
// today counts once done; every 7 consecutive done days earns a freeze, max 2 banked
export function canUseRestDay(state: StreakState, today: LocalDate): boolean; // max one per Mon–Sun week
export function minutesLeftToday(now: number): number; // until local midnight

// game/ranks.ts
export function rankProgress(goal: GoalRecord, tests: TestResultRecord[], specsForGoal: (g: GoalId) => StretchSpec[], goalName: string): RankProgress; // RankProgress from services/contract.ts

// game/badges.ts
export interface BadgeMeta { id: string; name: string; description: string; }
export const BADGES: BadgeMeta[]; // first_grass, first_floor, streak_7, streak_30, streak_100, holds_100, perfect_week, first_test
export function newBadges(ctx: { earned: Record<string, number>; streak: StreakState; totalHolds: number; ranksReached: string[]; testsTaken: number; weekAllDone: boolean }): string[];

// game/gus.ts
export function gusMood(input: { now: number; doneToday: boolean; settings: Settings; streak: StreakState }): GusMood;
// done → thriving; before sessionTime → waiting; after 18:00 not done → wilting; streak 0 and no session in 3+ days → dormant
export function gusLine(mood: GusMood, tone: Tone, seed: number, ctx: { streak: number; minutesPlanned: number }): string;
```

## D · Reminders + storage — `src/core/reminders/`, `src/core/db/`

```ts
// reminders/ladder.ts
export function ladderTimes(settings: Settings): string[]; // 5 'HH:MM' times: T, T+4:45, T+10:15, T+13:15, T+14:45 (T = sessionTime); a time past 23:59 or inside quiet hours is dropped (returns fewer than 5 only via planReminders filtering — keep index = step)

// reminders/messages.ts
export const MESSAGES: Record<Tone, string[][]>; // [step][variant], >= 3 variants per step per tone, may contain {streak} and {minutes}
export function pickMessage(tone: Tone, step: number, seed: number, ctx: { streak: number; minutes: number }): { title: string; body: string };

// reminders/scheduler.ts
export function planReminders(input: { now: number; settings: Settings; doneDates: Set<LocalDate>; streak: number; minutesPlanned: number; days?: number /*12*/; max?: number /*60*/ }): ScheduledReminder[];
// skips: dates already done, disabled steps, times <= now, quiet hours; last step (4) body mentions the 3-minute rescue; url 'grasswork://session?kind=daily' (step 4: kind=rescue)
export interface NotificationAdapter { scheduledIds(): Promise<string[]>; schedule(r: ScheduledReminder): Promise<void>; cancel(id: string): Promise<void>; }
export function syncNotifications(adapter: NotificationAdapter, desired: ScheduledReminder[]): Promise<{ scheduled: number; cancelled: number }>; // cancel stale ids, add missing, keep matching ones

// reminders/expoAdapter.ts  (the ONLY file in src/core allowed to import 'expo-notifications'; excluded from tsconfig.core.json and tests)
export function createExpoNotificationAdapter(): NotificationAdapter;

// db/memoryRepo.ts
export function createMemoryRepo(seed?: Partial<{ settings: Settings }>): Repo;
// db/sqliteRepo.ts (the ONLY db file allowed to import 'expo-sqlite'; excluded from tsconfig.core.json and tests)
export function createSqliteRepo(dbName?: string): Promise<Repo>;
// db/schema.ts — SQL strings + MIGRATIONS: string[] (shared by sqliteRepo; testable as plain strings)
```

## E · Screens — `app/`, `src/ui/`

Expo Router screens matching the GUI review. Talk to `AppServices` via `useServices()` from `src/ui/ServicesProvider.tsx`
(the provider takes an `AppServices` instance as a prop; wave 2 supplies the real one). Session screens use A + B directly plus
`usePoseFrameProcessor` from F. Theme tokens in `src/ui/theme.ts` (already written). No logic duplication: import from `src/core`.

## F · Native pose bridge — `modules/pose-landmarker/`, `src/native/`

```ts
// src/native/pose.ts
export function usePoseFrameProcessor(onFrame: (f: PoseFrame) => void, opts?: { model?: 'lite' | 'full'; fps?: number /*15*/ }): ReadonlyFrameProcessor; // for VisionCamera <Camera frameProcessor>
export function poseModelAvailable(): boolean;
```
Expo local module + VisionCamera frame-processor plugin named `detectPose`, Swift (MediaPipeTasksVision) and Kotlin (com.google.mediapipe:tasks-vision),
model files `pose_landmarker_lite.task` / `pose_landmarker_full.task` loaded from app assets (document the download in the module README).

## Wave 2 · Services — `src/services/`
`src/services/app.ts`: `createAppServices(repo: Repo, notifications: NotificationAdapter): AppServices`, built only from A, C, D. Tests with the memory repo and a fake adapter.

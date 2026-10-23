/**
 * Shared contracts for every Grasswork module.
 *
 * Rules for this file:
 * - Pure types and constants only. No imports from React Native, Expo, or any library.
 * - Every module under src/core/** may import from here; nothing here imports from them.
 * - Coordinates are MediaPipe-normalized image coordinates: x and y in [0,1], origin top-left, y grows DOWN.
 */

// ---------------------------------------------------------------------------
// Pose landmarks (MediaPipe Pose Landmarker, 33 points)
// ---------------------------------------------------------------------------

export interface Landmark {
  x: number;
  y: number;
  z: number;
  /** 0..1 confidence that the point is visible in the image */
  visibility: number;
}

/** Always length 33, indexed by LM below. */
export type Pose = Landmark[];

export const LM = {
  NOSE: 0,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_INDEX: 19,
  R_INDEX: 20,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
  L_HEEL: 29,
  R_HEEL: 30,
  L_FOOT_INDEX: 31,
  R_FOOT_INDEX: 32,
} as const;

export const POSE_LANDMARK_COUNT = 33;

export type Side = 'left' | 'right';

export type JointName =
  | 'shoulder'
  | 'elbow'
  | 'wrist'
  | 'index'
  | 'hip'
  | 'knee'
  | 'ankle'
  | 'heel'
  | 'foot_index';

/** One camera frame's pose result. Produced by the native bridge, consumed by the evaluator. */
export interface PoseFrame {
  /** ms timestamp (monotonic within a session) */
  t: number;
  /** null when no person was detected in the frame */
  landmarks: Pose | null;
  /** image aspect ratio width/height, used to make angles correct in non-square frames */
  aspect: number;
}

/** Captured during the 2-second "stand still" step at the start of each session. */
export interface Calibration {
  /** y of the floor line (lowest heel/toe while standing), normalized */
  floorY: number;
  /** limb lengths in normalized units (aspect-corrected), from the camera-facing side */
  thigh: number;
  shin: number;
  torso: number;
  side: Side;
}

// ---------------------------------------------------------------------------
// Stretch specs (data, shipped with the app as JSON)
// ---------------------------------------------------------------------------

export type CameraView = 'side' | 'front';

export type GoalId = 'deep_squat' | 'forward_fold' | 'front_split' | 'bridge' | 'overhead_reach' | 'straddle';

/**
 * Names of computed metrics. The evaluator owns a registry mapping each id to a function
 * (pose, calibration) => number. Rules and depth reference metrics by id, so specs stay JSON.
 */
export type MetricId =
  | 'kneeAngle' // hip-knee-ankle angle in degrees (180 = straight leg)
  | 'hipAngle' // shoulder-hip-knee angle in degrees
  | 'hipBelowKnee' // (hip.y - knee.y) / thigh ; > 0 means hip lower than knee
  | 'heelLift' // (floorY - heel.y) / shin ; ~0 when heel is on the floor
  | 'fingertipToFloor' // (floorY - index.y) / shin ; <= 0 means fingertips at/below floor line
  | 'torsoLean' // degrees from vertical of hip->shoulder
  | 'backThighVertical' // degrees from vertical of the rear thigh (couch stretch)
  | 'straddleAngle' // angle between the two legs, degrees (front view)
  | 'shoulderFlexion' // hip-shoulder-wrist angle, degrees
  | 'hipHeight'; // (floorY - hip.y) / torso

export type RuleOp = '<' | '<=' | '>' | '>=';

export interface RuleSpec {
  id: string;
  metric: MetricId;
  op: RuleOp;
  value: number;
  /** short spoken cue when this rule fails, e.g. "Sit lower" */
  cue: string;
}

export interface StretchSpec {
  id: string;
  /** goal this stretch is a level of; null for supporting stretches */
  goalId: GoalId | null;
  /** 0 = easiest variant within the goal; higher = harder */
  level: number;
  /** rank name unlocked when this level's target is reached, e.g. "Curb" */
  rank: string | null;
  name: string;
  view: CameraView;
  /** both sides are held separately (e.g. couch stretch) */
  perSide: boolean;
  required: JointName[];
  rules: RuleSpec[];
  /** metric recorded as the hold's depth score */
  depthMetric: MetricId;
  /** 'higher' means a larger metric value is deeper/better */
  depthBetter: 'higher' | 'lower';
  /** depth value at which this level counts as reached */
  targetDepth: number;
  defaultHoldS: number;
  /** one-line how-to shown before the hold */
  instructions: string;
}

// ---------------------------------------------------------------------------
// Evaluator output
// ---------------------------------------------------------------------------

export interface EvalResult {
  t: number;
  /** all required joints visible above threshold */
  visible: boolean;
  /** the person is facing the right way for this stretch's view */
  orientationOk: boolean;
  /** visible && orientationOk && every rule passes */
  valid: boolean;
  /** ids of rules that failed this frame */
  failed: string[];
  /** cues of failed rules in spec order (first = most important) */
  cues: string[];
  /** depth metric value, null when not visible */
  depth: number | null;
  /** all metrics computed this frame, for debug overlays */
  metrics: Partial<Record<MetricId, number>>;
  /** person is standing upright (used for entry/exit detection) */
  standing: boolean;
}

// ---------------------------------------------------------------------------
// Persistence records
// ---------------------------------------------------------------------------

/** Local calendar date, 'YYYY-MM-DD' */
export type LocalDate = string;

export type SessionKind = 'daily' | 'test' | 'rescue';

export interface SessionRecord {
  id: string;
  date: LocalDate;
  kind: SessionKind;
  startedAt: number;
  endedAt: number | null;
  /** true once at least one hold was verified and the session reached the summary */
  completed: boolean;
}

export interface AttemptRecord {
  id: string;
  sessionId: string;
  stretchId: string;
  side: Side | null;
  startedAt: number;
  endedAt: number;
  /** seconds the pose was verified as valid */
  heldS: number;
  targetS: number;
  bestDepth: number | null;
  /** share of hold frames that were valid, 0..1 */
  validRatio: number;
  /** rule id -> number of frames it failed */
  failedRules: Record<string, number>;
  /** hold reached targetS */
  completed: boolean;
  /** user pressed "It hurts" */
  hurt: boolean;
}

export interface TestResultRecord {
  id: string;
  goalId: GoalId;
  stretchId: string;
  date: LocalDate;
  bestDepth: number;
}

export interface GoalRecord {
  goalId: GoalId;
  /** stretch id of the current variant (level) */
  currentStretchId: string;
  status: 'active' | 'paused' | 'done';
  startedAt: number;
}

export type Tone = 'polite' | 'sassy' | 'unhinged';

export interface Settings {
  /** e.g. "After coffee" */
  anchorLabel: string;
  /** 'HH:MM' local */
  sessionTime: string;
  quietStart: string; // 'HH:MM'
  quietEnd: string; // 'HH:MM'
  tone: Tone;
  /** which of the 5 ladder steps are enabled, index 0..4 */
  ladderEnabled: [boolean, boolean, boolean, boolean, boolean];
  /** 0=Sunday..6=Saturday, weekday for the weekly test */
  testWeekday: number;
  voiceCues: boolean;
  onboarded: boolean;
}

export interface StreakState {
  current: number;
  longest: number;
  freezesBanked: number;
  /** last local date that counted toward the streak (done, frozen or rest) */
  lastCountedDate: LocalDate | null;
  /** local date of the rest day used in the current week, if any */
  restDayUsed: LocalDate | null;
}

export type DayStatus = 'done' | 'frozen' | 'rest' | 'missed';

export interface XpEvent {
  id: string;
  at: number;
  source: 'hold' | 'personal_best' | 'test_beat' | 'rank_up' | 'badge' | 'streak_milestone';
  amount: number;
  ref: string | null;
}

export interface ReminderLogRecord {
  id: string;
  /** ladder step 0..4 */
  step: number;
  scheduledFor: number;
  sentAt: number | null;
  openedAt: number | null;
}

// ---------------------------------------------------------------------------
// Plans (output of the progression engine)
// ---------------------------------------------------------------------------

export interface PlanItem {
  stretchId: string;
  sets: number;
  holdS: number;
  /** goal this item serves, null for supporting stretches */
  goalId: GoalId | null;
}

export interface DayPlan {
  date: LocalDate;
  kind: SessionKind;
  items: PlanItem[];
  /** sum of holds incl. sides and rests, seconds */
  estimatedS: number;
}

// ---------------------------------------------------------------------------
// Reminders (output of the scheduler)
// ---------------------------------------------------------------------------

export interface ScheduledReminder {
  /** stable id: `${date}#${step}` so the same reminder is never double-scheduled */
  id: string;
  date: LocalDate;
  step: number; // 0..4
  fireAt: number; // epoch ms
  title: string;
  body: string;
  /** deep link opened when tapped */
  url: string;
}

// ---------------------------------------------------------------------------
// Gus
// ---------------------------------------------------------------------------

export type GusMood = 'thriving' | 'waiting' | 'wilting' | 'dormant';

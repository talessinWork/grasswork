/**
 * The one API the screens talk to. Implemented in src/services/app.ts (wave 2), consumed by app/** screens.
 * Screens never touch the Repo or core modules for persistence directly; they call these methods and render the view models.
 * Live camera work (evaluator, hold verifier, session reducer) is used by the session screens directly, not through here.
 */
import type {
  AttemptRecord,
  DayPlan,
  DayStatus,
  GoalId,
  GusMood,
  LocalDate,
  SessionKind,
  SessionRecord,
  Settings,
  StreakState,
  XpEvent,
} from '../core/types';

export interface LevelInfo {
  level: number;
  /** xp earned inside the current level */
  intoLevel: number;
  /** xp needed to finish the current level */
  forNext: number;
  total: number;
}

export interface RankProgress {
  goalId: GoalId;
  goalName: string;
  /** null before the first weekly test */
  currentRank: string | null;
  nextRank: string | null;
  /** 0..1 toward nextRank */
  progress: number;
  currentStretchId: string;
}

export interface WeekDot {
  date: LocalDate;
  /** 'Mo', 'Tu', ... */
  label: string;
  status: DayStatus | 'today' | 'future';
}

export interface PlanLine {
  stretchId: string;
  name: string;
  /** e.g. "2 × 40 s" or "30 s each side" */
  detail: string;
}

export interface HomeVM {
  date: LocalDate;
  /** true after 18:00 local and today's session not done: screens switch to the dusk palette */
  evening: boolean;
  doneToday: boolean;
  streak: StreakState;
  level: LevelInfo;
  gus: GusMood;
  gusLine: string;
  plan: DayPlan;
  planLines: PlanLine[];
  /** minutes until the day ends for streak purposes; null when done or not at risk */
  minutesLeft: number | null;
  /** rescue session is offered (after 21:00, not done) */
  rescueAvailable: boolean;
  isTestDay: boolean;
  goals: RankProgress[];
  week: WeekDot[];
}

export interface TestPoint {
  date: LocalDate;
  /** depth metric of the test, in the goal's display unit */
  value: number;
  personalBest: boolean;
}

export interface PathVM {
  goalId: GoalId;
  goalName: string;
  /** ladder of rank names in order with state */
  ranks: { name: string; state: 'done' | 'current' | 'locked' }[];
  rank: RankProgress;
  tests: TestPoint[];
  /** label of the y axis and the reference line, e.g. "cm below knee", "knee height" */
  unit: string;
  referenceLabel: string;
  /** one sentence: what it takes to rank up */
  nextStepText: string;
}

export interface BossVM {
  goalId: GoalId;
  bossName: string; // e.g. "The Floor"
  weekNumber: number;
  /** last week's best, display string, e.g. "4 cm above the floor" */
  lastBestText: string | null;
  /** 0..1 how much of the boss's health remains */
  health: number;
  rewards: { label: string; value: string }[];
}

export interface SummaryVM {
  sessionId: string;
  dayNumber: number; // streak after this session
  holdsVerified: number;
  secondsHeld: number;
  xpEarned: number;
  xpBreakdown: XpEvent[];
  personalBests: { stretchId: string; name: string; text: string }[];
  rankUps: { goalId: GoalId; rank: string }[];
  newBadges: { id: string; name: string }[];
  nextSessionText: string; // e.g. "See you tomorrow at 07:45"
}

export interface AppServices {
  init(): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
  /** saves goals + settings, marks onboarded, schedules reminders */
  completeOnboarding(input: { goals: GoalId[]; settings: Settings }): Promise<void>;
  getHome(now: number): Promise<HomeVM>;
  getPath(goalId: GoalId, now: number): Promise<PathVM>;
  getBoss(goalId: GoalId, now: number): Promise<BossVM>;
  /** creates the session record and returns today's plan for that kind */
  startSession(kind: SessionKind, now: number): Promise<{ session: SessionRecord; plan: DayPlan }>;
  /** persists one finished hold; returns xp earned and whether it was a personal best */
  recordAttempt(a: AttemptRecord): Promise<{ xp: XpEvent[]; personalBest: boolean }>;
  /** closes the session: streak, tests, promotions, badges, reminders */
  finishSession(sessionId: string, now: number): Promise<SummaryVM>;
  /** recompute and (re)schedule local notifications; call on every app open */
  syncReminders(now: number): Promise<void>;
  useRestDay(now: number): Promise<boolean>;
  exportJson(): Promise<string>;
}

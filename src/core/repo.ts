/**
 * Storage contract. Two implementations live in src/core/db/:
 * - memoryRepo.ts: in-memory, used by tests (pure TS, no deps)
 * - sqliteRepo.ts: expo-sqlite, used by the app
 * Everything is async so both implementations share one interface.
 */
import type {
  AttemptRecord,
  GoalId,
  GoalRecord,
  LocalDate,
  ReminderLogRecord,
  SessionRecord,
  Settings,
  StreakState,
  TestResultRecord,
  XpEvent,
} from './types';

export interface Repo {
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;

  listGoals(): Promise<GoalRecord[]>;
  upsertGoal(g: GoalRecord): Promise<void>;

  saveSession(s: SessionRecord): Promise<void>;
  getSession(id: string): Promise<SessionRecord | null>;
  /** sessions with date in [from, to] inclusive, oldest first */
  listSessions(from: LocalDate, to: LocalDate): Promise<SessionRecord[]>;

  saveAttempt(a: AttemptRecord): Promise<void>;
  listAttemptsForSession(sessionId: string): Promise<AttemptRecord[]>;
  /** attempts whose startedAt >= sinceMs, oldest first */
  listAttemptsSince(sinceMs: number): Promise<AttemptRecord[]>;

  saveTestResult(r: TestResultRecord): Promise<void>;
  /** oldest first */
  listTestResults(goalId: GoalId): Promise<TestResultRecord[]>;

  getStreak(): Promise<StreakState>;
  saveStreak(s: StreakState): Promise<void>;

  addXp(e: XpEvent): Promise<void>;
  totalXp(): Promise<number>;
  listXp(sinceMs: number): Promise<XpEvent[]>;

  logReminder(r: ReminderLogRecord): Promise<void>;
  listReminderLog(sinceMs: number): Promise<ReminderLogRecord[]>;

  /** badge id -> earned-at ms */
  listBadges(): Promise<Record<string, number>>;
  awardBadge(id: string, at: number): Promise<void>;

  /** whole database as plain JSON (for the export button) */
  exportAll(): Promise<object>;
}

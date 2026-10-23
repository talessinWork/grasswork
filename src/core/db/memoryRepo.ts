/**
 * In-memory Repo. Used by tests and by services tests. Pure TS, no deps.
 * Every read and write deep-copies so callers can never mutate stored state.
 * Saving a record with an existing id replaces it (upsert), keeping its original insertion position.
 */
import type { Repo } from '../repo';
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
} from '../types';
import { DEFAULT_SETTINGS, EMPTY_STREAK } from '../util';

function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

/** Stable sort by a numeric/string key (Array.prototype.sort is stable in ES2019+). */
function sortBy<T>(arr: T[], key: (t: T) => number | string): T[] {
  return arr.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

export function createMemoryRepo(seed?: Partial<{ settings: Settings }>): Repo {
  let settings: Settings = clone({ ...DEFAULT_SETTINGS, ...(seed?.settings ?? {}) });
  let streak: StreakState = clone(EMPTY_STREAK);
  const goals = new Map<GoalId, GoalRecord>();
  const sessions = new Map<string, SessionRecord>();
  const attempts = new Map<string, AttemptRecord>();
  const tests = new Map<string, TestResultRecord>();
  const xp = new Map<string, XpEvent>();
  const reminders = new Map<string, ReminderLogRecord>();
  const badges = new Map<string, number>();

  return {
    async getSettings() {
      return clone(settings);
    },
    async saveSettings(s) {
      settings = clone(s);
    },

    async listGoals() {
      return clone([...goals.values()]);
    },
    async upsertGoal(g) {
      goals.set(g.goalId, clone(g));
    },

    async saveSession(s) {
      sessions.set(s.id, clone(s));
    },
    async getSession(id) {
      const s = sessions.get(id);
      return s ? clone(s) : null;
    },
    async listSessions(from: LocalDate, to: LocalDate) {
      const list = [...sessions.values()].filter((s) => s.date >= from && s.date <= to);
      return clone(sortBy(sortBy(list, (s) => s.startedAt), (s) => s.date));
    },

    async saveAttempt(a) {
      attempts.set(a.id, clone(a));
    },
    async listAttemptsForSession(sessionId) {
      const list = [...attempts.values()].filter((a) => a.sessionId === sessionId);
      return clone(sortBy(list, (a) => a.startedAt));
    },
    async listAttemptsSince(sinceMs) {
      const list = [...attempts.values()].filter((a) => a.startedAt >= sinceMs);
      return clone(sortBy(list, (a) => a.startedAt));
    },

    async saveTestResult(r) {
      tests.set(r.id, clone(r));
    },
    async listTestResults(goalId) {
      const list = [...tests.values()].filter((t) => t.goalId === goalId);
      return clone(sortBy(list, (t) => t.date));
    },

    async getStreak() {
      return clone(streak);
    },
    async saveStreak(s) {
      streak = clone(s);
    },

    async addXp(e) {
      xp.set(e.id, clone(e));
    },
    async totalXp() {
      let sum = 0;
      for (const e of xp.values()) sum += e.amount;
      return sum;
    },
    async listXp(sinceMs) {
      const list = [...xp.values()].filter((e) => e.at >= sinceMs);
      return clone(sortBy(list, (e) => e.at));
    },

    async logReminder(r) {
      reminders.set(r.id, clone(r));
    },
    async listReminderLog(sinceMs) {
      const list = [...reminders.values()].filter((r) => r.scheduledFor >= sinceMs);
      return clone(sortBy(list, (r) => r.scheduledFor));
    },

    async listBadges() {
      return Object.fromEntries(badges.entries());
    },
    async awardBadge(id, at) {
      // first award wins: earned-at never moves
      if (!badges.has(id)) badges.set(id, at);
    },

    async exportAll() {
      return clone({
        version: 1,
        settings,
        streak,
        goals: [...goals.values()],
        sessions: sortBy([...sessions.values()], (s) => s.startedAt),
        attempts: sortBy([...attempts.values()], (a) => a.startedAt),
        testResults: sortBy([...tests.values()], (t) => t.date),
        xpEvents: sortBy([...xp.values()], (e) => e.at),
        reminderLog: sortBy([...reminders.values()], (r) => r.scheduledFor),
        badges: Object.fromEntries(badges.entries()),
      });
    },
  };
}

/**
 * expo-sqlite implementation of Repo (async API, SDK 53).
 * The only db file allowed to import 'expo-sqlite' (excluded from tsc core + tests).
 * exportAll() returns the same shape as memoryRepo.
 */
import * as SQLite from 'expo-sqlite';
import type { Repo } from '../repo';
import type {
  AttemptRecord,
  GoalId,
  GoalRecord,
  ReminderLogRecord,
  SessionKind,
  SessionRecord,
  Settings,
  Side,
  StreakState,
  TestResultRecord,
  XpEvent,
} from '../types';
import { DEFAULT_SETTINGS, EMPTY_STREAK } from '../util';
import { MIGRATIONS } from './schema';

type Db = SQLite.SQLiteDatabase;

// ---------------------------------------------------------------------------
// Row types (snake_case, as stored)
// ---------------------------------------------------------------------------

interface JsonRow { json: string }
interface GoalRow { goal_id: string; current_stretch_id: string; status: string; started_at: number }
interface SessionRow { id: string; date: string; kind: string; started_at: number; ended_at: number | null; completed: number }
interface AttemptRow {
  id: string; session_id: string; stretch_id: string; side: string | null; started_at: number; ended_at: number;
  held_s: number; target_s: number; best_depth: number | null; valid_ratio: number; failed_rules: string;
  completed: number; hurt: number;
}
interface TestRow { id: string; goal_id: string; stretch_id: string; date: string; best_depth: number }
interface XpRow { id: string; at: number; source: string; amount: number; ref: string | null }
interface ReminderRow { id: string; step: number; scheduled_for: number; sent_at: number | null; opened_at: number | null }
interface BadgeRow { id: string; earned_at: number }

const toGoal = (r: GoalRow): GoalRecord => ({
  goalId: r.goal_id as GoalId,
  currentStretchId: r.current_stretch_id,
  status: r.status as GoalRecord['status'],
  startedAt: r.started_at,
});

const toSession = (r: SessionRow): SessionRecord => ({
  id: r.id,
  date: r.date,
  kind: r.kind as SessionKind,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  completed: !!r.completed,
});

function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

const toAttempt = (r: AttemptRow): AttemptRecord => ({
  id: r.id,
  sessionId: r.session_id,
  stretchId: r.stretch_id,
  side: (r.side as Side | null) ?? null,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  heldS: r.held_s,
  targetS: r.target_s,
  bestDepth: r.best_depth,
  validRatio: r.valid_ratio,
  failedRules: parseJson<Record<string, number>>(r.failed_rules, {}),
  completed: !!r.completed,
  hurt: !!r.hurt,
});

const toTest = (r: TestRow): TestResultRecord => ({
  id: r.id,
  goalId: r.goal_id as GoalId,
  stretchId: r.stretch_id,
  date: r.date,
  bestDepth: r.best_depth,
});

const toXp = (r: XpRow): XpEvent => ({
  id: r.id,
  at: r.at,
  source: r.source as XpEvent['source'],
  amount: r.amount,
  ref: r.ref,
});

const toReminder = (r: ReminderRow): ReminderLogRecord => ({
  id: r.id,
  step: r.step,
  scheduledFor: r.scheduled_for,
  sentAt: r.sent_at,
  openedAt: r.opened_at,
});

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

async function migrate(db: Db): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}

// ---------------------------------------------------------------------------
// Repo
// ---------------------------------------------------------------------------

export async function createSqliteRepo(dbName = 'grasswork.db'): Promise<Repo> {
  const db = await SQLite.openDatabaseAsync(dbName);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await migrate(db);

  const getSettings = async (): Promise<Settings> => {
    const row = await db.getFirstAsync<JsonRow>('SELECT json FROM settings WHERE id = 1');
    return { ...DEFAULT_SETTINGS, ...parseJson<Partial<Settings>>(row?.json, {}) };
  };

  const getStreak = async (): Promise<StreakState> => {
    const row = await db.getFirstAsync<JsonRow>('SELECT json FROM streak WHERE id = 1');
    return { ...EMPTY_STREAK, ...parseJson<Partial<StreakState>>(row?.json, {}) };
  };

  const listBadges = async (): Promise<Record<string, number>> => {
    const rows = await db.getAllAsync<BadgeRow>('SELECT id, earned_at FROM badges ORDER BY earned_at, rowid');
    const out: Record<string, number> = {};
    for (const r of rows) out[r.id] = r.earned_at;
    return out;
  };

  return {
    getSettings,
    async saveSettings(s) {
      await db.runAsync(
        'INSERT INTO settings (id, json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json',
        [JSON.stringify(s)],
      );
    },

    async listGoals() {
      const rows = await db.getAllAsync<GoalRow>('SELECT * FROM goals ORDER BY rowid');
      return rows.map(toGoal);
    },
    async upsertGoal(g) {
      await db.runAsync(
        `INSERT INTO goals (goal_id, current_stretch_id, status, started_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(goal_id) DO UPDATE SET current_stretch_id = excluded.current_stretch_id,
           status = excluded.status, started_at = excluded.started_at`,
        [g.goalId, g.currentStretchId, g.status, g.startedAt],
      );
    },

    async saveSession(s) {
      await db.runAsync(
        `INSERT INTO sessions (id, date, kind, started_at, ended_at, completed) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET date = excluded.date, kind = excluded.kind, started_at = excluded.started_at,
           ended_at = excluded.ended_at, completed = excluded.completed`,
        [s.id, s.date, s.kind, s.startedAt, s.endedAt, s.completed ? 1 : 0],
      );
    },
    async getSession(id) {
      const row = await db.getFirstAsync<SessionRow>('SELECT * FROM sessions WHERE id = ?', [id]);
      return row ? toSession(row) : null;
    },
    async listSessions(from, to) {
      const rows = await db.getAllAsync<SessionRow>(
        'SELECT * FROM sessions WHERE date >= ? AND date <= ? ORDER BY date, started_at, rowid',
        [from, to],
      );
      return rows.map(toSession);
    },

    async saveAttempt(a) {
      await db.runAsync(
        `INSERT INTO attempts (id, session_id, stretch_id, side, started_at, ended_at, held_s, target_s, best_depth,
           valid_ratio, failed_rules, completed, hurt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET session_id = excluded.session_id, stretch_id = excluded.stretch_id,
           side = excluded.side, started_at = excluded.started_at, ended_at = excluded.ended_at,
           held_s = excluded.held_s, target_s = excluded.target_s, best_depth = excluded.best_depth,
           valid_ratio = excluded.valid_ratio, failed_rules = excluded.failed_rules,
           completed = excluded.completed, hurt = excluded.hurt`,
        [
          a.id, a.sessionId, a.stretchId, a.side, a.startedAt, a.endedAt, a.heldS, a.targetS, a.bestDepth,
          a.validRatio, JSON.stringify(a.failedRules ?? {}), a.completed ? 1 : 0, a.hurt ? 1 : 0,
        ],
      );
    },
    async listAttemptsForSession(sessionId) {
      const rows = await db.getAllAsync<AttemptRow>(
        'SELECT * FROM attempts WHERE session_id = ? ORDER BY started_at, rowid',
        [sessionId],
      );
      return rows.map(toAttempt);
    },
    async listAttemptsSince(sinceMs) {
      const rows = await db.getAllAsync<AttemptRow>(
        'SELECT * FROM attempts WHERE started_at >= ? ORDER BY started_at, rowid',
        [sinceMs],
      );
      return rows.map(toAttempt);
    },

    async saveTestResult(r) {
      await db.runAsync(
        `INSERT INTO test_results (id, goal_id, stretch_id, date, best_depth) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET goal_id = excluded.goal_id, stretch_id = excluded.stretch_id,
           date = excluded.date, best_depth = excluded.best_depth`,
        [r.id, r.goalId, r.stretchId, r.date, r.bestDepth],
      );
    },
    async listTestResults(goalId) {
      const rows = await db.getAllAsync<TestRow>(
        'SELECT * FROM test_results WHERE goal_id = ? ORDER BY date, rowid',
        [goalId],
      );
      return rows.map(toTest);
    },

    getStreak,
    async saveStreak(s) {
      await db.runAsync(
        'INSERT INTO streak (id, json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json',
        [JSON.stringify(s)],
      );
    },

    async addXp(e) {
      await db.runAsync(
        `INSERT INTO xp_events (id, at, source, amount, ref) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET at = excluded.at, source = excluded.source,
           amount = excluded.amount, ref = excluded.ref`,
        [e.id, e.at, e.source, e.amount, e.ref],
      );
    },
    async totalXp() {
      const row = await db.getFirstAsync<{ total: number | null }>('SELECT SUM(amount) AS total FROM xp_events');
      return row?.total ?? 0;
    },
    async listXp(sinceMs) {
      const rows = await db.getAllAsync<XpRow>('SELECT * FROM xp_events WHERE at >= ? ORDER BY at, rowid', [sinceMs]);
      return rows.map(toXp);
    },

    async logReminder(r) {
      await db.runAsync(
        `INSERT INTO reminder_log (id, step, scheduled_for, sent_at, opened_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET step = excluded.step, scheduled_for = excluded.scheduled_for,
           sent_at = excluded.sent_at, opened_at = excluded.opened_at`,
        [r.id, r.step, r.scheduledFor, r.sentAt, r.openedAt],
      );
    },
    async listReminderLog(sinceMs) {
      const rows = await db.getAllAsync<ReminderRow>(
        'SELECT * FROM reminder_log WHERE scheduled_for >= ? ORDER BY scheduled_for, rowid',
        [sinceMs],
      );
      return rows.map(toReminder);
    },

    listBadges,
    async awardBadge(id, at) {
      // first award wins: earned-at never moves
      await db.runAsync('INSERT OR IGNORE INTO badges (id, earned_at) VALUES (?, ?)', [id, at]);
    },

    async exportAll() {
      const [settings, streak, goals, sessions, attempts, tests, xp, reminders, badges] = await Promise.all([
        getSettings(),
        getStreak(),
        db.getAllAsync<GoalRow>('SELECT * FROM goals ORDER BY rowid'),
        db.getAllAsync<SessionRow>('SELECT * FROM sessions ORDER BY started_at, rowid'),
        db.getAllAsync<AttemptRow>('SELECT * FROM attempts ORDER BY started_at, rowid'),
        db.getAllAsync<TestRow>('SELECT * FROM test_results ORDER BY date, rowid'),
        db.getAllAsync<XpRow>('SELECT * FROM xp_events ORDER BY at, rowid'),
        db.getAllAsync<ReminderRow>('SELECT * FROM reminder_log ORDER BY scheduled_for, rowid'),
        listBadges(),
      ]);
      return {
        version: 1,
        settings,
        streak,
        goals: goals.map(toGoal),
        sessions: sessions.map(toSession),
        attempts: attempts.map(toAttempt),
        testResults: tests.map(toTest),
        xpEvents: xp.map(toXp),
        reminderLog: reminders.map(toReminder),
        badges,
      };
    },
  };
}

/**
 * SQLite schema for Grasswork. Plain SQL strings shared by sqliteRepo (and testable without SQLite).
 * MIGRATIONS[i] upgrades the database from user_version i to i+1; apply in order.
 */

export const TABLES = [
  'settings',
  'goals',
  'sessions',
  'attempts',
  'test_results',
  'streak',
  'xp_events',
  'reminder_log',
  'badges',
] as const;

export type TableName = (typeof TABLES)[number];

const V1 = `
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  goal_id TEXT PRIMARY KEY NOT NULL,
  current_stretch_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  kind TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  completed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions (date, started_at);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  stretch_id TEXT NOT NULL,
  side TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  held_s REAL NOT NULL,
  target_s REAL NOT NULL,
  best_depth REAL,
  valid_ratio REAL NOT NULL,
  failed_rules TEXT NOT NULL DEFAULT '{}',
  completed INTEGER NOT NULL DEFAULT 0,
  hurt INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_attempts_session ON attempts (session_id, started_at);
CREATE INDEX IF NOT EXISTS idx_attempts_started ON attempts (started_at);

CREATE TABLE IF NOT EXISTS test_results (
  id TEXT PRIMARY KEY NOT NULL,
  goal_id TEXT NOT NULL,
  stretch_id TEXT NOT NULL,
  date TEXT NOT NULL,
  best_depth REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_test_results_goal ON test_results (goal_id, date);

CREATE TABLE IF NOT EXISTS streak (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS xp_events (
  id TEXT PRIMARY KEY NOT NULL,
  at INTEGER NOT NULL,
  source TEXT NOT NULL,
  amount INTEGER NOT NULL,
  ref TEXT
);
CREATE INDEX IF NOT EXISTS idx_xp_events_at ON xp_events (at);

CREATE TABLE IF NOT EXISTS reminder_log (
  id TEXT PRIMARY KEY NOT NULL,
  step INTEGER NOT NULL,
  scheduled_for INTEGER NOT NULL,
  sent_at INTEGER,
  opened_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_reminder_log_sched ON reminder_log (scheduled_for);

CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY NOT NULL,
  earned_at INTEGER NOT NULL
);
`;

/** Index i migrates user_version i -> i+1. Append only; never edit a shipped entry. */
export const MIGRATIONS: string[] = [V1];

export const SCHEMA_VERSION = MIGRATIONS.length;

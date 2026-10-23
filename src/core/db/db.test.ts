import { describe, it, expect } from 'bun:test';
import type { AttemptRecord, GoalRecord, ReminderLogRecord, SessionRecord, TestResultRecord, XpEvent } from '../types';
import { DEFAULT_SETTINGS, EMPTY_STREAK, atTime } from '../util';
import { createMemoryRepo } from './memoryRepo';
import { MIGRATIONS, TABLES } from './schema';

const T0 = atTime('2026-03-10', '08:00');

const session = (id: string, date: string, startedAt: number): SessionRecord => ({
  id, date, kind: 'daily', startedAt, endedAt: startedAt + 60_000, completed: true,
});
const attempt = (id: string, sessionId: string, startedAt: number): AttemptRecord => ({
  id, sessionId, stretchId: 'squat_chair', side: null, startedAt, endedAt: startedAt + 30_000,
  heldS: 25, targetS: 30, bestDepth: 0.1, validRatio: 0.9, failedRules: { heels: 3 }, completed: false, hurt: false,
});

describe('memoryRepo', () => {
  it('settings: defaults, seed merge, round-trip', async () => {
    expect(await createMemoryRepo().getSettings()).toEqual(DEFAULT_SETTINGS);
    const repo = createMemoryRepo({ settings: { ...DEFAULT_SETTINGS, tone: 'unhinged' } });
    expect((await repo.getSettings()).tone).toBe('unhinged');
    const s = { ...DEFAULT_SETTINGS, sessionTime: '06:15', ladderEnabled: [true, false, true, false, true] as DEFAULT_LADDER };
    await repo.saveSettings(s);
    expect(await repo.getSettings()).toEqual(s);
  });

  it('partial seed merges with defaults', async () => {
    const repo = createMemoryRepo({ settings: { tone: 'polite' } as any });
    const s = await repo.getSettings();
    expect(s.tone).toBe('polite');
    expect(s.sessionTime).toBe(DEFAULT_SETTINGS.sessionTime);
  });

  it('goals upsert by goalId', async () => {
    const repo = createMemoryRepo();
    const g: GoalRecord = { goalId: 'deep_squat', currentStretchId: 'squat_chair', status: 'active', startedAt: T0 };
    await repo.upsertGoal(g);
    await repo.upsertGoal({ goalId: 'forward_fold', currentStretchId: 'fold_knees', status: 'active', startedAt: T0 });
    await repo.upsertGoal({ ...g, currentStretchId: 'squat_curb' });
    const goals = await repo.listGoals();
    expect(goals.length).toBe(2);
    expect(goals[0]).toEqual({ ...g, currentStretchId: 'squat_curb' });
  });

  it('sessions: get, upsert, range inclusive oldest first', async () => {
    const repo = createMemoryRepo();
    await repo.saveSession(session('c', '2026-03-12', T0 + 2e8));
    await repo.saveSession(session('a', '2026-03-10', T0 + 1000));
    await repo.saveSession(session('a0', '2026-03-10', T0));
    await repo.saveSession(session('b', '2026-03-11', T0 + 1e8));
    await repo.saveSession(session('z', '2026-03-13', T0 + 3e8));
    expect(await repo.getSession('nope')).toBeNull();
    expect((await repo.getSession('b'))!.date).toBe('2026-03-11');
    expect((await repo.listSessions('2026-03-10', '2026-03-12')).map((s) => s.id)).toEqual(['a0', 'a', 'b', 'c']);
    await repo.saveSession({ ...session('b', '2026-03-11', T0 + 1e8), completed: false });
    expect((await repo.getSession('b'))!.completed).toBe(false);
    expect((await repo.listSessions('2026-03-01', '2026-03-31')).length).toBe(5);
  });

  it('attempts: by session and since, oldest first', async () => {
    const repo = createMemoryRepo();
    await repo.saveAttempt(attempt('a3', 's1', T0 + 300));
    await repo.saveAttempt(attempt('a1', 's1', T0 + 100));
    await repo.saveAttempt(attempt('b1', 's2', T0 + 200));
    await repo.saveAttempt(attempt('old', 's0', T0 - 1));
    expect((await repo.listAttemptsForSession('s1')).map((a) => a.id)).toEqual(['a1', 'a3']);
    expect((await repo.listAttemptsSince(T0)).map((a) => a.id)).toEqual(['a1', 'b1', 'a3']);
    expect((await repo.listAttemptsForSession('s1'))[0]).toEqual(attempt('a1', 's1', T0 + 100));
  });

  it('test results per goal, oldest first', async () => {
    const repo = createMemoryRepo();
    const tr = (id: string, date: string, goalId: TestResultRecord['goalId'] = 'deep_squat'): TestResultRecord => ({
      id, goalId, stretchId: 'squat_chair', date, bestDepth: 0.2,
    });
    await repo.saveTestResult(tr('2', '2026-03-17'));
    await repo.saveTestResult(tr('1', '2026-03-10'));
    await repo.saveTestResult(tr('f', '2026-03-11', 'forward_fold'));
    expect((await repo.listTestResults('deep_squat')).map((t) => t.id)).toEqual(['1', '2']);
    expect((await repo.listTestResults('forward_fold')).length).toBe(1);
    expect(await repo.listTestResults('bridge')).toEqual([]);
  });

  it('streak: EMPTY_STREAK initially, round-trip', async () => {
    const repo = createMemoryRepo();
    expect(await repo.getStreak()).toEqual(EMPTY_STREAK);
    const s = { current: 4, longest: 9, freezesBanked: 1, lastCountedDate: '2026-03-09', restDayUsed: null };
    await repo.saveStreak(s);
    expect(await repo.getStreak()).toEqual(s);
  });

  it('xp: total, since, oldest first', async () => {
    const repo = createMemoryRepo();
    expect(await repo.totalXp()).toBe(0);
    const e = (id: string, at: number, amount: number): XpEvent => ({ id, at, source: 'hold', amount, ref: null });
    await repo.addXp(e('x2', T0 + 10, 40));
    await repo.addXp(e('x1', T0, 25));
    await repo.addXp(e('x0', T0 - 10, 5));
    expect(await repo.totalXp()).toBe(70);
    expect((await repo.listXp(T0)).map((x) => x.id)).toEqual(['x1', 'x2']);
  });

  it('reminder log: upsert and since', async () => {
    const repo = createMemoryRepo();
    const r = (id: string, at: number): ReminderLogRecord => ({ id, step: 0, scheduledFor: at, sentAt: null, openedAt: null });
    await repo.logReminder(r('b', T0 + 5));
    await repo.logReminder(r('a', T0));
    await repo.logReminder(r('old', T0 - 5));
    await repo.logReminder({ ...r('a', T0), openedAt: T0 + 60 });
    const list = await repo.listReminderLog(T0);
    expect(list.map((x) => x.id)).toEqual(['a', 'b']);
    expect(list[0].openedAt).toBe(T0 + 60);
  });

  it('badges: first award wins', async () => {
    const repo = createMemoryRepo();
    expect(await repo.listBadges()).toEqual({});
    await repo.awardBadge('first_grass', T0);
    await repo.awardBadge('first_grass', T0 + 99);
    await repo.awardBadge('streak_7', T0 + 1);
    expect(await repo.listBadges()).toEqual({ first_grass: T0, streak_7: T0 + 1 });
  });

  it('isolated from caller mutation (writes and reads)', async () => {
    const repo = createMemoryRepo();
    const a = attempt('a1', 's1', T0);
    await repo.saveAttempt(a);
    a.failedRules.heels = 999;
    a.heldS = 0;
    const read = (await repo.listAttemptsForSession('s1'))[0];
    expect(read.failedRules.heels).toBe(3);
    read.failedRules.heels = 777;
    expect((await repo.listAttemptsSince(0))[0].failedRules.heels).toBe(3);

    const s = await repo.getSettings();
    s.ladderEnabled[0] = false;
    s.tone = 'polite';
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS);

    const st = await repo.getStreak();
    st.current = 50;
    expect((await repo.getStreak()).current).toBe(0);

    const b = await repo.listBadges();
    b.x = 1;
    expect(await repo.listBadges()).toEqual({});

    const ex = (await repo.exportAll()) as any;
    ex.attempts[0].heldS = -1;
    expect((await repo.getSession('nope'))).toBeNull();
    expect((await repo.listAttemptsSince(0))[0].heldS).toBe(25);
  });

  it('does not share default constants', async () => {
    const repo = createMemoryRepo();
    const st = await repo.getStreak();
    st.current = 3;
    expect(EMPTY_STREAK.current).toBe(0);
    const s = await repo.getSettings();
    s.ladderEnabled[1] = false;
    expect(DEFAULT_SETTINGS.ladderEnabled[1]).toBe(true);
  });

  it('exportAll shape', async () => {
    const repo = createMemoryRepo();
    await repo.saveSession(session('s1', '2026-03-10', T0));
    await repo.saveAttempt(attempt('a1', 's1', T0));
    await repo.addXp({ id: 'x', at: T0, source: 'hold', amount: 10, ref: 'a1' });
    await repo.awardBadge('first_grass', T0);
    const ex = (await repo.exportAll()) as Record<string, unknown>;
    expect(Object.keys(ex).sort()).toEqual(
      ['attempts', 'badges', 'goals', 'reminderLog', 'sessions', 'settings', 'streak', 'testResults', 'version', 'xpEvents'].sort(),
    );
    expect(ex.settings).toEqual(DEFAULT_SETTINGS);
    expect(ex.streak).toEqual(EMPTY_STREAK);
    expect((ex.sessions as unknown[]).length).toBe(1);
    expect((ex.attempts as unknown[]).length).toBe(1);
    expect(ex.badges).toEqual({ first_grass: T0 });
    expect(JSON.parse(JSON.stringify(ex))).toEqual(ex);
  });
});

type DEFAULT_LADDER = [boolean, boolean, boolean, boolean, boolean];

describe('schema', () => {
  it('MIGRATIONS non-empty strings', () => {
    expect(MIGRATIONS.length).toBeGreaterThan(0);
    for (const m of MIGRATIONS) expect(typeof m === 'string' && m.trim().length > 0).toBe(true);
  });
  it('every table is created', () => {
    const all = MIGRATIONS.join('\n');
    for (const t of ['settings', 'goals', 'sessions', 'attempts', 'test_results', 'streak', 'xp_events', 'reminder_log', 'badges']) {
      expect(TABLES as readonly string[]).toContain(t);
      expect(all).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${t}\\s*\\(`));
    }
  });
  it('attempts stores failed_rules as text', () => {
    expect(MIGRATIONS.join('\n')).toMatch(/failed_rules TEXT/);
  });
  it('migrations do not set user_version themselves (runner does)', () => {
    for (const m of MIGRATIONS) expect(m).not.toMatch(/user_version/i);
  });
});

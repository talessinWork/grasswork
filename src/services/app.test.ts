import { describe, it, expect } from 'bun:test';
import { createAppServices } from './app';
import { createReminderSyncer, fingerprint } from './reminderSync';
import { depthToDisplay, planDetail } from './helpers';
import { createMemoryRepo } from '../core/db/memoryRepo';
import { getSpec } from '../core/evaluator/specs/index';
import { planReminders, type NotificationAdapter } from '../core/reminders/scheduler';
import { DEFAULT_SETTINGS, addDays, atTime } from '../core/util';
import type { AttemptRecord, ScheduledReminder, SessionKind, Settings } from '../core/types';
import type { AppServices } from './contract';
import type { Repo } from '../core/repo';

// ---------------------------------------------------------------------------
// fakes
// ---------------------------------------------------------------------------

function fakeAdapter() {
  const queued = new Map<string, ScheduledReminder>();
  const log: string[] = [];
  const adapter: NotificationAdapter = {
    async scheduledIds() {
      return [...queued.keys()];
    },
    async schedule(r) {
      queued.set(r.id, { ...r });
      log.push(`+${r.id}`);
    },
    async cancel(id) {
      queued.delete(id);
      log.push(`-${id}`);
    },
  };
  return { adapter, queued, log };
}

const MON = '2026-10-19'; // Monday; default test weekday is Friday (2026-10-23, 2026-10-30)
const SETTINGS: Settings = { ...DEFAULT_SETTINGS, sessionTime: '07:45', tone: 'polite' };

let seq = 0;
function attempt(sessionId: string, stretchId: string, startedAt: number, depth: number, heldS = 30, side: AttemptRecord['side'] = null): AttemptRecord {
  seq++;
  return {
    id: `a${seq}`,
    sessionId,
    stretchId,
    side,
    startedAt,
    endedAt: startedAt + heldS * 1000,
    heldS,
    targetS: heldS,
    bestDepth: depth,
    validRatio: 1,
    failedRules: {},
    completed: true,
    hurt: false,
  };
}

interface World {
  repo: Repo;
  svc: AppServices;
  fake: ReturnType<typeof fakeAdapter>;
  clockNow: { t: number };
}

function world(): World {
  const repo = createMemoryRepo();
  const fake = fakeAdapter();
  const clockNow = { t: atTime(MON, '07:00') };
  let r = 0;
  const svc = createAppServices(repo, fake.adapter, { clock: () => clockNow.t, random: () => ((r = (r * 9301 + 49297) % 233280) / 233280) });
  return { repo, svc, fake, clockNow };
}

/** run a session of `kind` at `date hh:mm`, one attempt per plan item/side with the given depths */
async function doSession(
  w: World,
  kind: SessionKind,
  date: string,
  hhmm: string,
  depths: { squat?: number; fold?: number } = {},
) {
  const now = atTime(date, hhmm);
  const { session, plan } = await w.svc.startSession(kind, now);
  let t = now + 1000;
  const results = [];
  for (const it of plan.items) {
    const spec = getSpec(it.stretchId);
    const depth =
      spec.goalId === 'deep_squat' ? depths.squat ?? -0.1 : spec.goalId === 'forward_fold' ? depths.fold ?? 1.2 : spec.targetDepth;
    const sides: AttemptRecord['side'][] = spec.perSide ? ['left', 'right'] : [null];
    for (let s = 0; s < it.sets; s++)
      for (const side of sides) {
        const a = attempt(session.id, it.stretchId, t, depth, it.holdS, side);
        results.push(await w.svc.recordAttempt(a));
        t = a.endedAt + 15_000;
      }
  }
  const summary = await w.svc.finishSession(session.id, t);
  return { session, plan, summary, results, end: t };
}

// ---------------------------------------------------------------------------
// the whole flow over fake days
// ---------------------------------------------------------------------------

describe('services flow', () => {
  const w = world();

  it('onboarding saves goals at level 0, marks onboarded and schedules reminders', async () => {
    await w.svc.completeOnboarding({ goals: ['deep_squat', 'forward_fold'], settings: SETTINGS });
    const goals = await w.repo.listGoals();
    expect(goals.map((g) => [g.goalId, g.currentStretchId, g.status, g.startedAt])).toEqual([
      ['deep_squat', 'squat_chair', 'active', w.clockNow.t],
      ['forward_fold', 'fold_knees', 'active', w.clockNow.t],
    ]);
    expect((await w.svc.getSettings()).onboarded).toBe(true);
    expect(w.fake.queued.size).toBeGreaterThan(40);
    expect(w.fake.queued.has(`${MON}#0`)).toBe(true);
  });

  it('home on day 1 morning', async () => {
    const home = await w.svc.getHome(atTime(MON, '07:30'));
    expect(home.date).toBe(MON);
    expect(home.doneToday).toBe(false);
    expect(home.evening).toBe(false);
    expect(home.rescueAvailable).toBe(false);
    expect(home.isTestDay).toBe(false);
    expect(home.gus).toBe('waiting');
    expect(home.gusLine.length).toBeGreaterThan(5);
    expect(home.gusLine).not.toContain('{');
    expect(home.minutesLeft).toBe(16 * 60 + 30);
    expect(home.planLines.map((l) => l.stretchId)).toEqual(['squat_chair', 'fold_knees', 'squat_sit', 'couch_stretch']);
    expect(home.planLines[0]).toEqual({ stretchId: 'squat_chair', name: 'Chair squat', detail: '2 × 30 s' });
    expect(home.planLines[3].detail).toMatch(/^\d+ s each side$/);
    expect(home.goals.map((g) => [g.goalName, g.currentRank, g.nextRank])).toEqual([
      ['Deep squat', null, 'Chair'],
      ['Forward fold', null, 'Knees'],
    ]);
    expect(home.level).toEqual({ level: 1, intoLevel: 0, forNext: 300, total: 0 });
    expect(home.week.map((d) => d.label)).toEqual(['Tu', 'We', 'Th', 'Fr', 'Sa', 'Su', 'Mo']);
    expect(home.week[6]).toEqual({ date: MON, label: 'Mo', status: 'today' });
    expect(home.week.slice(0, 6).every((d) => d.status === 'future')).toBe(true); // before the user started
  });

  it('day 1 session: xp, personal best, streak, summary, reminders cancelled for today', async () => {
    const { summary, results } = await doSession(w, 'daily', MON, '07:50');
    expect(results[0].personalBest).toBe(true);
    expect(results[1].personalBest).toBe(false); // same depth on set 2 is not deeper
    expect(results[0].xp.find((e) => e.source === 'hold')).toBeTruthy();
    expect(summary.dayNumber).toBe(1);
    expect(summary.holdsVerified).toBe(7); // 2 + 2 + 1 + 2 sides
    expect(summary.xpEarned).toBe(summary.xpBreakdown.reduce((s, e) => s + e.amount, 0));
    expect(summary.xpEarned).toBeGreaterThan(100);
    expect(summary.personalBests.map((p) => p.stretchId).sort()).toEqual(['couch_stretch', 'fold_knees', 'squat_chair', 'squat_sit']);
    expect(summary.personalBests.find((p) => p.stretchId === 'squat_chair')!.text).toBe('4 cm above knee');
    expect(summary.nextSessionText).toBe('See you tomorrow at 07:45');
    expect(summary.rankUps).toEqual([]);
    expect([...w.fake.queued.keys()].some((id) => id.startsWith(MON))).toBe(false);
    expect(w.fake.queued.has(`${addDays(MON, 1)}#0`)).toBe(true);
    expect((await w.repo.getStreak()).current).toBe(1);
    expect(await w.repo.totalXp()).toBe(summary.xpEarned);
  });

  it('home after the session: done, thriving, no countdown', async () => {
    const home = await w.svc.getHome(atTime(MON, '19:00'));
    expect(home.doneToday).toBe(true);
    expect(home.evening).toBe(false);
    expect(home.minutesLeft).toBeNull();
    expect(home.gus).toBe('thriving');
    expect(home.week[6].status).toBe('done');
    expect(home.streak.current).toBe(1);
  });

  it('next day home shows the week dots and evening state', async () => {
    const tue = addDays(MON, 1);
    const home = await w.svc.getHome(atTime(tue, '18:30'));
    expect(home.week.slice(5).map((d) => [d.label, d.status])).toEqual([
      ['Mo', 'done'],
      ['Tu', 'today'],
    ]);
    expect(home.evening).toBe(true);
    expect(home.gus).toBe('wilting');
    expect(home.rescueAvailable).toBe(false);
    expect(home.streak.current).toBe(1);
    expect(home.minutesLeft).toBe(5 * 60 + 30);
  });

  it('first test day (Friday): test results saved, no promotion after one pass', async () => {
    for (let d = 1; d <= 3; d++) await doSession(w, 'daily', addDays(MON, d), '08:00');
    const fri = addDays(MON, 4);
    const home = await w.svc.getHome(atTime(fri, '07:00'));
    expect(home.isTestDay).toBe(true);
    const { plan, summary } = await doSession(w, 'test', fri, '08:00', { squat: 0.05, fold: 0.9 });
    expect(plan.kind).toBe('test');
    expect(plan.items.map((i) => [i.stretchId, i.sets, i.holdS])).toEqual([
      ['squat_chair', 1, 20],
      ['fold_knees', 1, 20],
    ]);
    expect(summary.rankUps).toEqual([]);
    expect(summary.newBadges.map((b) => b.id)).toContain('first_test');
    expect(summary.xpBreakdown.some((e) => e.source === 'test_beat')).toBe(true);
    expect((await w.repo.listTestResults('deep_squat')).map((t) => [t.stretchId, t.date, t.bestDepth])).toEqual([
      ['squat_chair', fri, 0.05],
    ]);
    expect((await w.svc.getHome(atTime(fri, '09:00'))).isTestDay).toBe(false);
    expect(summary.dayNumber).toBe(5);
  });

  it('path and boss after one test', async () => {
    const fri = addDays(MON, 4);
    const path = await w.svc.getPath('deep_squat', atTime(fri, '10:00'));
    expect(path.goalName).toBe('Deep squat');
    expect(path.unit).toBe('cm below knee');
    expect(path.referenceLabel).toBe('knee height');
    expect(path.ranks).toEqual([
      { name: 'Chair', state: 'done' },
      { name: 'Bench', state: 'current' },
      { name: 'Curb', state: 'locked' },
      { name: 'Grass', state: 'locked' },
    ]);
    expect(path.rank.currentRank).toBe('Chair');
    expect(path.tests).toEqual([{ date: fri, value: depthToDisplay(getSpec('squat_chair'), 0.05), personalBest: true }]);
    expect(path.tests[0].value).toBe(2);
    expect(path.nextStepText).toContain('Bench');

    const boss = await w.svc.getBoss('forward_fold', atTime(fri, '10:00'));
    expect(boss.bossName).toBe('The Floor');
    expect(boss.weekNumber).toBe(1);
    expect(boss.lastBestText).toBe('36 cm to floor');
    expect(boss.health).toBe(0); // target of the current level already reached once
    expect(boss.rewards).toEqual([
      { label: 'Beat last week', value: '+300 XP' },
      { label: 'Reach Shins', value: 'Rank up' },
    ]);
  });

  it('7-day streak earns milestone xp and a freeze', async () => {
    await doSession(w, 'daily', addDays(MON, 5), '08:00');
    const { summary } = await doSession(w, 'daily', addDays(MON, 6), '08:00');
    expect(summary.dayNumber).toBe(7);
    expect(summary.xpBreakdown.filter((e) => e.source === 'streak_milestone').map((e) => e.amount)).toEqual([100]);
    expect(summary.newBadges.map((b) => b.id)).toEqual(expect.arrayContaining(['streak_7', 'perfect_week']));
    const st = await w.svc.getHome(atTime(addDays(MON, 6), '20:00'));
    expect(st.streak.freezesBanked).toBe(1);
  });

  it('missed day is covered by a freeze and shows as frozen', async () => {
    const missed = addDays(MON, 7); // Mon 26
    const tue = addDays(MON, 8);
    const home = await w.svc.getHome(atTime(tue, '07:00'));
    expect(home.streak.current).toBe(7);
    expect(home.streak.freezesBanked).toBe(0);
    expect(home.week.find((d) => d.date === missed)!.status).toBe('frozen');
    const { summary } = await doSession(w, 'daily', tue, '08:00');
    expect(summary.dayNumber).toBe(8);
  });

  it('rescue session after 21:00 counts for the day', async () => {
    const wed = addDays(MON, 9);
    const before = await w.svc.getHome(atTime(wed, '21:15'));
    expect(before.rescueAvailable).toBe(true);
    expect(before.evening).toBe(true);
    const { plan, summary } = await doSession(w, 'rescue', wed, '21:20');
    expect(plan.kind).toBe('rescue');
    expect(plan.items.every((i) => i.sets === 1 && i.holdS <= 30 && i.goalId !== null)).toBe(true);
    expect(plan.estimatedS).toBeLessThan(240);
    expect(summary.dayNumber).toBe(9);
    const after = await w.svc.getHome(atTime(wed, '21:40'));
    expect(after.doneToday).toBe(true);
    expect(after.rescueAvailable).toBe(false);
    expect(after.evening).toBe(false);
  });

  it('a queued reminder is re-scheduled with new text after a tone change', async () => {
    const thu = addDays(MON, 10);
    await doSession(w, 'daily', thu, '08:00');
    const id = `${addDays(thu, 1)}#2`;
    const before = w.fake.queued.get(id)!;
    expect(before).toBeTruthy();
    w.clockNow.t = atTime(thu, '12:00');
    w.fake.log.length = 0;
    await w.svc.saveSettings({ ...(await w.svc.getSettings()), tone: 'unhinged' });
    const after = w.fake.queued.get(id)!;
    expect(after.fireAt).toBe(before.fireAt);
    expect(`${after.title}|${after.body}`).not.toBe(`${before.title}|${before.body}`);
    expect(w.fake.log).toContain(`-${id}`);
    expect(w.fake.log).toContain(`+${id}`);
    // every queued reminder now matches what the scheduler wants
    const desired = planReminders({ now: w.clockNow.t, settings: await w.svc.getSettings(), doneDates: new Set([thu]), streak: 11, minutesPlanned: 1, days: 12 });
    expect(desired.length).toBeGreaterThan(0);
    for (const q of w.fake.queued.values()) expect(q.body).not.toContain('{');
    // a second sync with nothing changed touches nothing
    w.fake.log.length = 0;
    await w.svc.syncReminders(w.clockNow.t);
    expect(w.fake.log).toEqual([]);
  });

  it('second passing test promotes both goals with rank-up xp', async () => {
    const fri = addDays(MON, 11);
    const xpBefore = await w.repo.totalXp();
    const { summary } = await doSession(w, 'test', fri, '08:00', { squat: 0.02, fold: 0.95 });
    expect(summary.rankUps).toEqual([
      { goalId: 'deep_squat', rank: 'Chair' },
      { goalId: 'forward_fold', rank: 'Knees' },
    ]);
    expect(summary.xpBreakdown.filter((e) => e.source === 'rank_up').map((e) => e.amount)).toEqual([200, 200]);
    expect(await w.repo.totalXp()).toBe(xpBefore + summary.xpEarned);
    const goals = await w.repo.listGoals();
    expect(goals.map((g) => g.currentStretchId)).toEqual(['squat_heels_raised', 'fold_shins']);
    const home = await w.svc.getHome(atTime(fri, '12:00'));
    expect(home.planLines.map((l) => l.stretchId).slice(0, 2)).toEqual(['squat_heels_raised', 'fold_shins']);
    const boss = await w.svc.getBoss('deep_squat', atTime(fri, '12:00'));
    expect(boss.weekNumber).toBe(2);
    expect(boss.health).toBe(1); // no test yet on the new level
    expect(boss.rewards[1]).toEqual({ label: 'Reach Bench', value: 'Rank up' });
  });

  it('rest day: once per week, counts toward the streak, cancels today reminders', async () => {
    const sat = addDays(MON, 12);
    const now = atTime(sat, '09:00');
    await w.svc.syncReminders(now);
    expect(w.fake.queued.has(`${sat}#1`)).toBe(true);
    expect(await w.svc.useRestDay(now)).toBe(true);
    expect([...w.fake.queued.keys()].some((id) => id.startsWith(sat))).toBe(false);
    const home = await w.svc.getHome(atTime(sat, '10:00'));
    expect(home.week[6].status).toBe('rest');
    expect(home.streak.current).toBe(12);
    expect(home.streak.restDayUsed).toBe(sat);
    expect(await w.svc.useRestDay(atTime(addDays(sat, 1), '09:00'))).toBe(false); // same Mon–Sun week
    const later = await w.svc.getHome(atTime(addDays(sat, 2), '07:00'));
    expect(later.week.find((d) => d.date === sat)!.status).toBe('rest');
  });

  it('export round-trips as JSON', async () => {
    const json = await w.svc.exportJson();
    const data = JSON.parse(json);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
    expect(data.goals.length).toBe(2);
    expect(data.sessions.length).toBeGreaterThan(10);
    expect(data.testResults.length).toBe(4);
    expect(data.settings.onboarded).toBe(true);
    expect(json).toContain('\n  ');
  });
});

// ---------------------------------------------------------------------------
// focused cases
// ---------------------------------------------------------------------------

describe('services edge cases', () => {
  it('a session with no verified hold is not completed and keeps reminders', async () => {
    const w = world();
    await w.svc.completeOnboarding({ goals: ['forward_fold'], settings: SETTINGS });
    const now = atTime(MON, '08:00');
    const { session } = await w.svc.startSession('daily', now);
    await w.svc.recordAttempt(attempt(session.id, 'fold_knees', now + 1000, 1.1, 3));
    const summary = await w.svc.finishSession(session.id, now + 60_000);
    expect(summary.holdsVerified).toBe(0);
    expect(summary.dayNumber).toBe(0);
    expect((await w.repo.getSession(session.id))!.completed).toBe(false);
    expect(w.fake.queued.has(`${MON}#1`)).toBe(true);
    expect((await w.svc.getHome(now + 120_000)).doneToday).toBe(false);
  });

  it('personal best respects depthBetter=lower (fold)', async () => {
    const w = world();
    await w.svc.completeOnboarding({ goals: ['forward_fold'], settings: SETTINGS });
    const { session } = await w.svc.startSession('daily', atTime(MON, '08:00'));
    const t = atTime(MON, '08:01');
    expect((await w.svc.recordAttempt(attempt(session.id, 'fold_knees', t, 1.2))).personalBest).toBe(true);
    expect((await w.svc.recordAttempt(attempt(session.id, 'fold_knees', t + 60_000, 1.3))).personalBest).toBe(false);
    expect((await w.svc.recordAttempt(attempt(session.id, 'fold_knees', t + 120_000, 1.1))).personalBest).toBe(true);
  });

  it('onboarding skips unavailable goals; not-onboarded sync schedules nothing', async () => {
    const w = world();
    await w.svc.syncReminders(atTime(MON, '07:00'));
    expect(w.fake.queued.size).toBe(0);
    await w.svc.completeOnboarding({ goals: ['deep_squat', 'bridge'], settings: SETTINGS });
    expect((await w.repo.listGoals()).map((g) => g.goalId)).toEqual(['deep_squat']);
  });

  it('streak change re-texts queued reminders', async () => {
    const w = world();
    await w.svc.completeOnboarding({ goals: ['deep_squat'], settings: SETTINGS });
    for (let d = 0; d < 3; d++) await doSession(w, 'daily', addDays(MON, d), '08:00');
    const now = atTime(addDays(MON, 2), '09:00');
    const settings = await w.svc.getSettings();
    const done = new Set([MON, addDays(MON, 1), addDays(MON, 2)]);
    const home = await w.svc.getHome(now);
    const desired = planReminders({ now, settings, doneDates: done, streak: 3, minutesPlanned: Math.max(1, Math.round(home.plan.estimatedS / 60)), days: 12 });
    for (const r of desired) expect(fingerprint(w.fake.queued.get(r.id)!)).toBe(fingerprint(r));
  });

  it('reminder syncer replaces unknown-content ids on first sync and is stable after', async () => {
    const fake = fakeAdapter();
    const r: ScheduledReminder = { id: 'x#0', date: MON, step: 0, fireAt: 1, title: 'a', body: 'b', url: 'u' };
    await fake.adapter.schedule({ ...r, body: 'old' });
    const syncer = createReminderSyncer(fake.adapter);
    const res = await syncer.sync([r]);
    expect(res.refreshed).toBe(1);
    expect(fake.queued.get('x#0')!.body).toBe('b');
    expect((await syncer.sync([r])).scheduled).toBe(0);
    expect((await syncer.sync([{ ...r, body: 'c' }])).refreshed).toBe(1);
    expect((await syncer.sync([])).cancelled).toBe(1);
    expect(fake.queued.size).toBe(0);
  });

  it('planDetail formats', () => {
    const squat = getSpec('squat_chair');
    const couch = getSpec('couch_stretch');
    expect(planDetail({ stretchId: squat.id, sets: 2, holdS: 40, goalId: 'deep_squat' }, squat)).toBe('2 × 40 s');
    expect(planDetail({ stretchId: couch.id, sets: 1, holdS: 30, goalId: null }, couch)).toBe('30 s each side');
  });
});

/**
 * AppServices: the one API the screens talk to. Built only from src/core (pure TS).
 * Time always comes from the `now` parameter; the few methods without one use opts.clock (default Date.now),
 * which is read in exactly one place below.
 */
import type { Repo } from '../core/repo';
import type {
  AttemptRecord,
  DayPlan,
  GoalId,
  GoalRecord,
  LocalDate,
  SessionKind,
  SessionRecord,
  Settings,
  StretchSpec,
  TestResultRecord,
  XpEvent,
} from '../core/types';
import type { AppServices, BossVM, HomeVM, PathVM, PlanLine, RankProgress, SummaryVM, TestPoint, WeekDot } from './contract';
import { formatDepth, getGoal, getSpec, specsForGoal, GOALS } from '../core/evaluator/specs/index';
import { buildDayPlan } from '../core/progression/plan';
import { evaluatePromotion } from '../core/progression/promotion';
import { isTestDay, weekNumber } from '../core/progression/testSchedule';
import { levelFor, xpForAttempt } from '../core/game/xp';
import { canUseRestDay, dayStatuses, minutesLeftToday, weekStart } from '../core/game/streak';
import { rankProgress } from '../core/game/ranks';
import { BADGES, newBadges } from '../core/game/badges';
import { gusLine, gusMood } from '../core/game/gus';
import { planReminders, type NotificationAdapter } from '../core/reminders/scheduler';
import { addDays, localMidnight, toLocalDate } from '../core/util';
import {
  EPOCH_DATE,
  createIdMaker,
  dayLabel,
  deeper,
  depthToDisplay,
  hashString,
  minutesPlanned,
  planDetail,
  reaches,
} from './helpers';
import { doneDatesSince, plainStreak, rollAndSave } from './streakStore';
import { createReminderSyncer } from './reminderSync';

export interface AppServicesOptions {
  /** randomness for record ids (default Math.random) */
  random?: () => number;
  /** clock for the methods that take no `now` (init, saveSettings, completeOnboarding); default Date.now */
  clock?: () => number;
}

export const RANK_UP_XP = 200;
export const TEST_BEAT_XP = 300;
export const BADGE_XP = 50;
export const STREAK_MILESTONES: Record<number, number> = { 7: 100, 30: 300, 100: 1000 };
/** an attempt with at least this many verified seconds completes the session */
export const MIN_VERIFIED_S = 5;
const HISTORY_DAYS = 28;
const REMINDER_DAYS = 12;
const EVENING_HOUR = 18;
const RESCUE_HOUR = 21;

export function createAppServices(repo: Repo, notifications: NotificationAdapter, opts?: AppServicesOptions): AppServices {
  const random = opts?.random ?? Math.random;
  const clock = opts?.clock ?? (() => Date.now());
  const newId = createIdMaker(random);
  const syncer = createReminderSyncer(notifications);

  // -------------------------------------------------------------------------
  // shared loaders
  // -------------------------------------------------------------------------

  async function activeGoals(): Promise<GoalRecord[]> {
    return (await repo.listGoals()).filter((g) => g.status === 'active');
  }

  async function planFor(kind: SessionKind, now: number, goals?: GoalRecord[]): Promise<DayPlan> {
    const today = toLocalDate(now);
    const from = addDays(today, -HISTORY_DAYS);
    const [g, sessions, attempts] = await Promise.all([
      goals ? Promise.resolve(goals) : repo.listGoals(),
      repo.listSessions(from, today),
      repo.listAttemptsSince(localMidnight(from)),
    ]);
    return buildDayPlan({ date: today, kind, now, goals: g, attempts, sessions, specLookup: getSpec, specsForGoal });
  }

  async function goalRecord(goalId: GoalId): Promise<GoalRecord> {
    const g = (await repo.listGoals()).find((x) => x.goalId === goalId);
    if (g) return g;
    const first = specsForGoal(goalId)[0];
    if (!first) throw new Error(`Goal "${goalId}" has no stretches yet`);
    // not chosen yet: show the ladder from the bottom
    return { goalId, currentStretchId: first.id, status: 'paused', startedAt: 0 };
  }

  async function progressFor(goal: GoalRecord): Promise<{ rank: RankProgress; tests: TestResultRecord[] }> {
    const tests = await repo.listTestResults(goal.goalId);
    return { rank: rankProgress(goal, tests, specsForGoal, getGoal(goal.goalId).name), tests };
  }

  /** all rank names reached so far, across goals (a rank implies every rank below it) */
  async function ranksReached(goals: GoalRecord[]): Promise<string[]> {
    const out: string[] = [];
    for (const g of goals) {
      const { rank } = await progressFor(g);
      if (!rank.currentRank) continue;
      const ranks = getGoal(g.goalId).ranks;
      const idx = ranks.indexOf(rank.currentRank);
      out.push(...(idx >= 0 ? ranks.slice(0, idx + 1) : [rank.currentRank]));
    }
    return out;
  }

  async function bestPreviousDepth(spec: StretchSpec, excludeIds: Set<string>, beforeMs: number): Promise<number | null> {
    const all = await repo.listAttemptsSince(0);
    let best: number | null = null;
    for (const a of all) {
      if (a.stretchId !== spec.id || excludeIds.has(a.id) || a.bestDepth === null || a.startedAt >= beforeMs) continue;
      if (best === null || deeper(spec, a.bestDepth, best)) best = a.bestDepth;
    }
    return best;
  }

  async function syncReminders(now: number): Promise<void> {
    const settings = await repo.getSettings();
    if (!settings.onboarded) {
      await syncer.sync([]);
      return;
    }
    const today = toLocalDate(now);
    const snap = await rollAndSave(repo, today);
    const done = await doneDatesSince(repo, today, addDays(today, REMINDER_DAYS));
    for (const d of snap.restDates) done.add(d);
    const plan = await planFor('daily', now);
    const desired = planReminders({
      now,
      settings,
      doneDates: done,
      streak: snap.state.current,
      minutesPlanned: minutesPlanned(plan.estimatedS),
      days: REMINDER_DAYS,
    });
    await syncer.sync(desired);
  }

  // -------------------------------------------------------------------------
  // AppServices
  // -------------------------------------------------------------------------

  const services: AppServices = {
    async init() {
      const now = clock();
      // Close sessions left open by a crash, a kill or iOS evicting the app mid-session, so the
      // verified work still counts and nothing stays half-open (review finding 3).
      const today = toLocalDate(now);
      const open = (await repo.listSessions(addDays(today, -30), today)).filter(
        (s) => s.endedAt === null,
      );
      for (const s of open) {
        const attempts = await repo.listAttemptsForSession(s.id);
        const verified = attempts.some((a) => a.heldS >= MIN_VERIFIED_S);
        const endedAt = attempts.reduce((m, a) => Math.max(m, a.endedAt), s.startedAt);
        await repo.saveSession({ ...s, endedAt, completed: s.completed || verified });
      }
      const settings = await repo.getSettings();
      if (settings.onboarded) await syncReminders(now);
    },

    getSettings: () => repo.getSettings(),

    async saveSettings(s: Settings) {
      await repo.saveSettings(s);
      await syncReminders(clock());
    },

    async completeOnboarding({ goals, settings }) {
      const now = clock();
      for (const goalId of goals) {
        const meta = getGoal(goalId);
        const first = specsForGoal(goalId)[0];
        if (!meta.available || !first) continue;
        await repo.upsertGoal({ goalId, currentStretchId: first.id, status: 'active', startedAt: now });
      }
      await repo.saveSettings({ ...settings, onboarded: true });
      await syncReminders(now);
    },

    async getHome(now: number): Promise<HomeVM> {
      const today = toLocalDate(now);
      const [settings, goals, sessions, totalXp] = await Promise.all([
        repo.getSettings(),
        activeGoals(),
        repo.listSessions(addDays(today, -HISTORY_DAYS), today),
        repo.totalXp(),
      ]);
      const plan = await planFor('daily', now, goals);
      const planLines: PlanLine[] = plan.items.map((it) => {
        const spec = getSpec(it.stretchId);
        return { stretchId: it.stretchId, name: spec.name, detail: planDetail(it, spec) };
      });
      const doneToday = sessions.some((s) => s.date === today && s.completed);
      const snap = await rollAndSave(repo, today);
      const streak = plainStreak(snap.state);
      const hour = new Date(now).getHours();

      const goalVMs: RankProgress[] = [];
      for (const g of goals) goalVMs.push((await progressFor(g)).rank);

      // week strip: last 7 days ending today
      const from = addDays(today, -6);
      const done = new Set(sessions.filter((s) => s.completed).map((s) => s.date));
      const statuses = dayStatuses({ today, from, doneDates: done, frozenDates: snap.frozenDates, restDates: snap.restDates });
      const startDates = goals.map((g) => toLocalDate(g.startedAt));
      const firstSession = sessions[0]?.date;
      if (firstSession) startDates.push(firstSession);
      const startedOn = startDates.length ? startDates.sort()[0] : today;
      const week: WeekDot[] = [];
      for (let i = 0; i < 7; i++) {
        const date = addDays(from, i);
        let status: WeekDot['status'];
        if (date === today) status = statuses.get(date) ?? 'today';
        else if (date < startedOn) status = 'future'; // before the user started: neutral, not "missed"
        else status = statuses.get(date) ?? 'missed';
        week.push({ date, label: dayLabel(date), status });
      }

      const mood = gusMood({ now, doneToday, settings, streak });
      const line = gusLine(mood, settings.tone, hashString(today), {
        streak: streak.current,
        minutesPlanned: minutesPlanned(plan.estimatedS),
      });

      return {
        date: today,
        evening: hour >= EVENING_HOUR && !doneToday,
        doneToday,
        streak,
        level: levelFor(totalXp),
        gus: mood,
        gusLine: line,
        plan,
        planLines,
        minutesLeft: doneToday ? null : minutesLeftToday(now),
        rescueAvailable: hour >= RESCUE_HOUR && !doneToday,
        isTestDay: isTestDay(today, settings, sessions),
        goals: goalVMs,
        week,
      };
    },

    async getPath(goalId: GoalId, _now: number): Promise<PathVM> {
      const meta = getGoal(goalId);
      const goal = await goalRecord(goalId);
      const { rank, tests } = await progressFor(goal);
      const ladder = specsForGoal(goalId);
      const reachedIdx = rank.currentRank ? ladder.findIndex((s) => s.rank === rank.currentRank) : -1;
      const ranks = ladder.map((s, i) => ({
        name: s.rank ?? s.name,
        state: (i <= reachedIdx ? 'done' : i === reachedIdx + 1 ? 'current' : 'locked') as 'done' | 'current' | 'locked',
      }));

      const points: TestPoint[] = [];
      let best: number | null = null;
      const ref = getSpec(goal.currentStretchId);
      for (const t of tests) {
        const spec = getSpec(t.stretchId);
        const pb = best === null || deeper(ref, t.bestDepth, best);
        if (pb) best = t.bestDepth;
        points.push({ date: t.date, value: depthToDisplay(spec, t.bestDepth), personalBest: pb });
      }

      let nextStepText: string;
      const nextSpec = rank.nextRank ? ladder.find((s) => s.rank === rank.nextRank) ?? null : null;
      if (!nextSpec) nextStepText = `You reached ${rank.currentRank ?? 'the top'}. Keep testing to hold your rank.`;
      else {
        const target = formatDepth(nextSpec, nextSpec.targetDepth);
        nextStepText = `Reach ${target} in a ${nextSpec.name.toLowerCase()} on test day to earn ${nextSpec.rank}.`;
      }

      return {
        goalId,
        goalName: meta.name,
        ranks,
        rank,
        tests: points,
        unit: meta.unit,
        referenceLabel: meta.referenceLabel,
        nextStepText,
      };
    },

    async getBoss(goalId: GoalId, now: number): Promise<BossVM> {
      const meta = getGoal(goalId);
      const goal = await goalRecord(goalId);
      const { rank, tests } = await progressFor(goal);
      const today = toLocalDate(now);
      const first = (await repo.listSessions(EPOCH_DATE, today))[0]?.date ?? null;
      const spec = getSpec(goal.currentStretchId);
      const latest = tests.length ? tests[tests.length - 1] : null;
      const lastBestText = latest ? formatDepth(getSpec(latest.stretchId), latest.bestDepth) : null;

      let health = 1;
      if (latest && latest.stretchId === spec.id) {
        if (reaches(spec, latest.bestDepth)) health = 0;
        else {
          // baseline: the shallowest of the first test on this stretch and the previous level's target
          const onStretch = tests.filter((t) => t.stretchId === spec.id).map((t) => t.bestDepth);
          const ladder = specsForGoal(goalId);
          const prev = ladder[ladder.findIndex((s) => s.id === spec.id) - 1];
          let baseline = onStretch[0];
          if (prev && deeper(spec, baseline, prev.targetDepth)) baseline = prev.targetDepth;
          const total = Math.abs(spec.targetDepth - baseline);
          const left = Math.abs(spec.targetDepth - latest.bestDepth);
          health = total > 0 ? Math.min(1, Math.max(0, left / total)) : 1;
        }
      }

      const rewards = [{ label: latest ? 'Beat last week' : 'Set your first mark', value: `+${TEST_BEAT_XP} XP` }];
      if (rank.nextRank) rewards.push({ label: `Reach ${rank.nextRank}`, value: 'Rank up' });

      return { goalId, bossName: meta.bossName, weekNumber: weekNumber(first, today), lastBestText, health, rewards };
    },

    async startSession(kind: SessionKind, now: number) {
      const plan = await planFor(kind, now);
      const session: SessionRecord = {
        id: newId('s_', now),
        date: toLocalDate(now),
        kind,
        startedAt: now,
        endedAt: null,
        completed: false,
      };
      await repo.saveSession(session);
      return { session, plan };
    },

    async recordAttempt(a: AttemptRecord) {
      const spec = getSpec(a.stretchId);
      const prevBest = await bestPreviousDepth(spec, new Set([a.id]), Number.POSITIVE_INFINITY);
      await repo.saveAttempt(a);
      // The day counts the moment one hold is verified, not only when the summary is reached,
      // so a crash or kill mid-session never costs the streak (review finding 3).
      if (a.heldS >= MIN_VERIFIED_S) {
        const session = await repo.getSession(a.sessionId);
        if (session && !session.completed) await repo.saveSession({ ...session, completed: true });
      }
      const xp = xpForAttempt(a, spec, prevBest, a.endedAt);
      for (const e of xp) await repo.addXp(e);
      return { xp, personalBest: xp.some((e) => e.source === 'personal_best') };
    },

    async finishSession(sessionId: string, now: number): Promise<SummaryVM> {
      const session = await repo.getSession(sessionId);
      if (!session) throw new Error(`Unknown session "${sessionId}"`);
      const attempts = await repo.listAttemptsForSession(sessionId);
      const verified = attempts.filter((a) => a.heldS >= MIN_VERIFIED_S);
      const completed = session.completed || verified.length > 0;
      await repo.saveSession({ ...session, endedAt: now, completed });

      const today = toLocalDate(now);
      const settings = await repo.getSettings();
      const goals = await repo.listGoals();
      const events: XpEvent[] = [];
      const addXp = async (e: XpEvent) => {
        events.push(e);
        await repo.addXp(e);
      };

      // weekly test: results, test-beat xp, promotions
      const rankUps: SummaryVM['rankUps'] = [];
      if (session.kind === 'test') {
        for (const goal of goals.filter((g) => g.status === 'active')) {
          const spec = getSpec(goal.currentStretchId);
          let best: number | null = null;
          for (const a of attempts) {
            if (a.stretchId !== spec.id || a.bestDepth === null || a.heldS < MIN_VERIFIED_S) continue;
            if (best === null || deeper(spec, a.bestDepth, best)) best = a.bestDepth;
          }
          if (best === null) continue;
          // One result per goal per day (review finding 15): a second test the same day keeps the
          // better depth instead of adding a second "consecutive" test that would promote instantly.
          const onStretch = (await repo.listTestResults(goal.goalId)).filter((t) => t.stretchId === spec.id);
          const sameDay = onStretch.find((t) => t.date === session.date);
          if (sameDay && !deeper(spec, best, sameDay.bestDepth)) best = sameDay.bestDepth;
          const prior = onStretch.filter((t) => t.date !== session.date);
          const last = prior.length ? prior[prior.length - 1].bestDepth : null;
          await repo.saveTestResult({ id: sameDay?.id ?? `${session.date}#${goal.goalId}`, goalId: goal.goalId, stretchId: spec.id, date: session.date, bestDepth: best });
          if (last === null || deeper(spec, best, last)) {
            await addXp({ id: `${session.date}#${goal.goalId}#test`, at: now, source: 'test_beat', amount: TEST_BEAT_XP, ref: goal.goalId });
          }
          const tests = await repo.listTestResults(goal.goalId);
          const promo = evaluatePromotion(goal, tests, specsForGoal);
          if (promo.promote && promo.nextStretchId) {
            await repo.upsertGoal({ ...goal, currentStretchId: promo.nextStretchId });
            const rank = spec.rank ?? spec.name;
            rankUps.push({ goalId: goal.goalId, rank });
            await addXp({ id: `rank_up#${goal.goalId}#${spec.id}`, at: now, source: 'rank_up', amount: RANK_UP_XP, ref: goal.goalId });
          }
        }
      }

      // streak + milestones
      const before = (await repo.getStreak()).current;
      const snap = await rollAndSave(repo, today);
      const streak = plainStreak(snap.state);
      for (const [m, amount] of Object.entries(STREAK_MILESTONES)) {
        const n = Number(m);
        if (before < n && streak.current >= n) {
          await addXp({ id: `streak#${n}#${today}`, at: now, source: 'streak_milestone', amount, ref: String(n) });
        }
      }

      // badges
      const allAttempts = await repo.listAttemptsSince(0);
      let testsTaken = 0;
      for (const g of GOALS) testsTaken += (await repo.listTestResults(g.id)).length;
      const ws = weekStart(today);
      const weekDone = await doneDatesSince(repo, ws, addDays(ws, 6));
      let weekAllDone = true;
      for (let i = 0; i < 7; i++) {
        const d = addDays(ws, i);
        if (!weekDone.has(d) && !snap.restDates.has(d)) weekAllDone = false;
      }
      const earned = await repo.listBadges();
      const fresh = newBadges({
        earned,
        streak,
        totalHolds: allAttempts.filter((a) => a.heldS >= MIN_VERIFIED_S).length,
        ranksReached: await ranksReached(await repo.listGoals()),
        testsTaken,
        weekAllDone,
      });
      for (const id of fresh) {
        await repo.awardBadge(id, now);
        await addXp({ id: `badge#${id}`, at: now, source: 'badge', amount: BADGE_XP, ref: id });
      }

      // summary
      const attemptIds = new Set(attempts.map((a) => a.id));
      const holdXp = (await repo.listXp(session.startedAt)).filter((e) => e.ref !== null && attemptIds.has(e.ref));
      const xpBreakdown = [...holdXp, ...events];

      const personalBests: SummaryVM['personalBests'] = [];
      for (const stretchId of [...new Set(attempts.map((a) => a.stretchId))]) {
        const spec = getSpec(stretchId);
        let best: number | null = null;
        for (const a of attempts) {
          if (a.stretchId !== stretchId || a.bestDepth === null || a.heldS < MIN_VERIFIED_S) continue;
          if (best === null || deeper(spec, a.bestDepth, best)) best = a.bestDepth;
        }
        if (best === null) continue;
        const prev = await bestPreviousDepth(spec, attemptIds, Number.POSITIVE_INFINITY);
        if (prev === null || deeper(spec, best, prev)) {
          personalBests.push({ stretchId, name: spec.name, text: formatDepth(spec, best) });
        }
      }

      const doneToday = completed || snap.doneDates.has(today);
      const summary: SummaryVM = {
        sessionId,
        dayNumber: streak.current,
        holdsVerified: verified.length,
        secondsHeld: Math.round(attempts.reduce((s, a) => s + a.heldS, 0)),
        xpEarned: xpBreakdown.reduce((s, e) => s + e.amount, 0),
        xpBreakdown,
        personalBests,
        rankUps,
        newBadges: fresh.map((id) => ({ id, name: BADGES.find((b) => b.id === id)?.name ?? id })),
        nextSessionText: doneToday
          ? `See you tomorrow at ${settings.sessionTime}`
          : 'Today still counts: try again before midnight',
      };

      await syncReminders(now);
      return summary;
    },

    syncReminders,

    async useRestDay(now: number) {
      const today = toLocalDate(now);
      const snap = await rollAndSave(repo, today);
      const doneToday = snap.doneDates.has(today) || (await doneDatesSince(repo, today, today)).has(today);
      if (doneToday || !canUseRestDay(plainStreak(snap.state), today)) return false;
      await rollAndSave(repo, today, today);
      await syncReminders(now);
      return true;
    },

    async exportJson() {
      return JSON.stringify(await repo.exportAll(), null, 2);
    },
  };

  return services;
}

import { describe, it, expect } from 'bun:test';
import { buildDayPlan, estimatePlanSeconds, missedDaysBefore, type PlanInput } from './plan';
import { attempt, specLookup, specsForGoal } from './testFixtures';
import type { GoalRecord, SessionRecord } from '../types';
import { addDays, atTime, localMidnight } from '../util';

const TODAY = '2026-10-23';
const NOW = atTime(TODAY, '08:00');
const DAY = 86_400_000;
const WEEK = 7 * DAY;

const squat = (p: Partial<GoalRecord> = {}): GoalRecord => ({
  goalId: 'deep_squat', currentStretchId: 'squat_curb', status: 'active', startedAt: NOW - 1000, ...p,
});
const fold = (p: Partial<GoalRecord> = {}): GoalRecord => ({
  goalId: 'forward_fold', currentStretchId: 'fold_ankles', status: 'active', startedAt: NOW - 1000, ...p,
});
const done = (date: string, kind: SessionRecord['kind'] = 'daily'): SessionRecord => ({
  id: `s-${date}`, date, kind, startedAt: localMidnight(date) + 8 * 3600_000, endedAt: null, completed: true,
});
const input = (p: Partial<PlanInput> = {}): PlanInput => ({
  date: TODAY, kind: 'daily', now: NOW, goals: [squat()], attempts: [],
  sessions: [done(addDays(TODAY, -1))], specLookup, specsForGoal, ...p,
});

describe('buildDayPlan daily', () => {
  it('has goal variant 2 sets + squat_sit + couch_stretch', () => {
    const plan = buildDayPlan(input());
    expect(plan.items).toEqual([
      { stretchId: 'squat_curb', sets: 2, holdS: 30, goalId: 'deep_squat' },
      { stretchId: 'squat_sit', sets: 1, holdS: 30, goalId: null },
      { stretchId: 'couch_stretch', sets: 1, holdS: 30, goalId: null },
    ]);
    // holds: 2 + 1 + 2 sides = 5 holds × 30 s + 4 rests × 15
    expect(plan.estimatedS).toBe(150 + 60);
    expect(plan.date).toBe(TODAY);
    expect(plan.kind).toBe('daily');
  });

  it('omits squat_sit without an active deep_squat goal, and skips paused/done goals', () => {
    const plan = buildDayPlan(input({ goals: [squat({ status: 'paused' }), fold(), { ...fold(), goalId: 'bridge', status: 'done' }] }));
    expect(plan.items.map((i) => i.stretchId)).toEqual(['fold_ankles', 'couch_stretch']);
  });

  it('grows hold by 5 s per full week since goal start', () => {
    expect(buildDayPlan(input({ goals: [squat({ startedAt: NOW - WEEK + 1 })] })).items[0].holdS).toBe(30);
    expect(buildDayPlan(input({ goals: [squat({ startedAt: NOW - WEEK })] })).items[0].holdS).toBe(35);
    expect(buildDayPlan(input({ goals: [squat({ startedAt: NOW - 3 * WEEK - 5 })] })).items[0].holdS).toBe(45);
  });

  it('caps estimatedS at 720 s', () => {
    const plan = buildDayPlan(input({ goals: [squat({ startedAt: NOW - 40 * WEEK }), fold({ startedAt: NOW - 40 * WEEK })] }));
    expect(plan.estimatedS).toBeLessThanOrEqual(720);
    expect(plan.estimatedS).toBeGreaterThan(680);
    expect(plan.estimatedS).toBe(estimatePlanSeconds(plan.items, specLookup));
    // goal holds still longer than the uncapped default
    expect(plan.items[0].holdS).toBeGreaterThan(30);
  });

  it('is deterministic', () => {
    const i = input({ goals: [squat(), fold()] });
    expect(buildDayPlan(i)).toEqual(buildDayPlan(i));
  });
});

describe('comeback', () => {
  it('counts missed days only after an earlier completed session', () => {
    expect(missedDaysBefore(TODAY, [])).toBe(0);
    expect(missedDaysBefore(TODAY, [done(addDays(TODAY, -1))])).toBe(0);
    expect(missedDaysBefore(TODAY, [done(addDays(TODAY, -3))])).toBe(2);
    expect(missedDaysBefore(TODAY, [done(addDays(TODAY, -30))])).toBe(14);
    expect(missedDaysBefore(TODAY, [{ ...done(addDays(TODAY, -1)), completed: false }, done(addDays(TODAY, -4))])).toBe(3);
  });

  it('halves sets and holds after >= 2 missed days', () => {
    const plan = buildDayPlan(input({ sessions: [done(addDays(TODAY, -3))] }));
    expect(plan.items[0]).toEqual({ stretchId: 'squat_curb', sets: 1, holdS: 15, goalId: 'deep_squat' });
    expect(plan.items[2]).toEqual({ stretchId: 'couch_stretch', sets: 1, holdS: 15, goalId: null });
  });

  it('does not halve after 1 missed day or for a brand-new user', () => {
    expect(buildDayPlan(input({ sessions: [done(addDays(TODAY, -2))] })).items[0].sets).toBe(2);
    expect(buildDayPlan(input({ sessions: [] })).items[0].sets).toBe(2);
  });
});

describe('hurt', () => {
  it('replaces a hurt stretch with the next easier level within 48 h', () => {
    const a = attempt({ stretchId: 'squat_curb', hurt: true, startedAt: NOW - 47 * 3600_000 });
    expect(buildDayPlan(input({ attempts: [a] })).items[0].stretchId).toBe('squat_heels_raised');
  });

  it('ignores hurt older than 48 h', () => {
    const a = attempt({ stretchId: 'squat_curb', hurt: true, startedAt: NOW - 49 * 3600_000 });
    expect(buildDayPlan(input({ attempts: [a] })).items[0].stretchId).toBe('squat_curb');
  });

  it('drops the goal item at level 0', () => {
    const a = attempt({ stretchId: 'squat_chair', hurt: true, startedAt: NOW - 3600_000 });
    const plan = buildDayPlan(input({ goals: [squat({ currentStretchId: 'squat_chair' })], attempts: [a] }));
    expect(plan.items.map((i) => i.stretchId)).toEqual(['squat_sit', 'couch_stretch']);
  });

  it('drops a hurt supporting stretch', () => {
    const a = attempt({ stretchId: 'couch_stretch', hurt: true, startedAt: NOW - 3600_000 });
    expect(buildDayPlan(input({ attempts: [a] })).items.map((i) => i.stretchId)).toEqual(['squat_curb', 'squat_sit']);
  });
});

describe('rescue and test', () => {
  it('rescue: 1 set per goal, hold min(30, normal), no supporting', () => {
    const plan = buildDayPlan(input({ kind: 'rescue', goals: [squat({ startedAt: NOW - 4 * WEEK }), fold()] }));
    expect(plan.items).toEqual([
      { stretchId: 'squat_curb', sets: 1, holdS: 30, goalId: 'deep_squat' },
      { stretchId: 'fold_ankles', sets: 1, holdS: 30, goalId: 'forward_fold' },
    ]);
    expect(plan.estimatedS).toBe(75);
    expect(plan.estimatedS).toBeLessThanOrEqual(180);
  });

  it('rescue is not halved by comeback', () => {
    const plan = buildDayPlan(input({ kind: 'rescue', sessions: [done(addDays(TODAY, -5))] }));
    expect(plan.items[0].holdS).toBe(30);
  });

  it('test: 1 set per goal at 20 s', () => {
    const plan = buildDayPlan(input({ kind: 'test', goals: [squat(), fold()] }));
    expect(plan.items.map((i) => [i.stretchId, i.sets, i.holdS])).toEqual([
      ['squat_curb', 1, 20],
      ['fold_ankles', 1, 20],
    ]);
    expect(plan.kind).toBe('test');
  });
});

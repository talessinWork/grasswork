import { describe, it, expect } from 'bun:test';
import type { AttemptRecord, DayPlan, StretchSpec } from '../types';
import { buildSteps, currentStep, initSession, reduceSession, type SessionEvent, type SessionState } from './sessionMachine';

function spec(id: string, view: 'side' | 'front', perSide = false): StretchSpec {
  return {
    id, goalId: null, level: 0, rank: null, name: id, view, perSide, required: [], rules: [],
    depthMetric: 'kneeAngle', depthBetter: 'higher', targetDepth: 0, defaultHoldS: 30, instructions: '',
  };
}
const SPECS: Record<string, StretchSpec> = {
  squat_chair: spec('squat_chair', 'side'),
  fold_knees: spec('fold_knees', 'side'),
  couch_stretch: spec('couch_stretch', 'side', true),
  straddle_x: spec('straddle_x', 'front'),
};
const lookup = (id: string) => {
  const s = SPECS[id];
  if (!s) throw new Error(id);
  return s;
};
function plan(items: [string, number, number][]): DayPlan {
  return { date: '2026-10-23', kind: 'daily', estimatedS: 0, items: items.map(([stretchId, sets, holdS]) => ({ stretchId, sets, holdS, goalId: null })) };
}
function attempt(stretchId: string, hurt = false): AttemptRecord {
  return { id: 'a', sessionId: 's', stretchId, side: null, startedAt: 0, endedAt: 0, heldS: 30, targetS: 30, bestDepth: null, validRatio: 1, failedRules: {}, completed: true, hurt };
}
function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}
const red = (s: SessionState, ...evs: SessionEvent[]) => evs.reduce(reduceSession, s);
/** from calibrated/framing/instructions, run one hold to completion */
function doHold(s: SessionState, now: number): SessionState {
  if (s.phase === 'framing') s = reduceSession(s, { type: 'FRAMING_OK' });
  expect(s.phase).toBe('instructions');
  s = reduceSession(s, { type: 'START_HOLD' });
  expect(s.phase).toBe('holding');
  return reduceSession(s, { type: 'HOLD_DONE', attempt: attempt(currentStep(s)!.stretchId), now });
}

describe('buildSteps', () => {
  it('expands sets and sides (left then right)', () => {
    const steps = buildSteps(plan([['squat_chair', 2, 30], ['couch_stretch', 2, 45]]), lookup);
    expect(steps.map((s) => [s.itemIndex, s.set, s.side, s.stretchId, s.holdS])).toEqual([
      [0, 1, null, 'squat_chair', 30],
      [0, 2, null, 'squat_chair', 30],
      [1, 1, 'left', 'couch_stretch', 45],
      [1, 1, 'right', 'couch_stretch', 45],
      [1, 2, 'left', 'couch_stretch', 45],
      [1, 2, 'right', 'couch_stretch', 45],
    ]);
  });
});

describe('reduceSession', () => {
  it('runs the happy path to summary', () => {
    let s = initSession(plan([['squat_chair', 2, 30]]), lookup, 1000);
    expect(s.phase).toBe('calibrating');
    expect(s.startedAt).toBe(1000);
    s = reduceSession(s, { type: 'CALIBRATED' });
    expect(s.phase).toBe('framing');
    s = doHold(s, 10_000);
    expect(s.phase).toBe('rest');
    expect(s.restUntil).toBe(25_000);
    s = reduceSession(s, { type: 'TICK', now: 24_999 });
    expect(s.phase).toBe('rest');
    s = reduceSession(s, { type: 'TICK', now: 25_000 });
    expect(s.phase).toBe('instructions'); // same view
    expect(s.stepIndex).toBe(1);
    expect(currentStep(s)!.set).toBe(2);
    s = doHold(s, 60_000);
    expect(s.phase).toBe('summary');
    expect(s.attempts.length).toBe(2);
    expect(currentStep(s)).toBeNull();
  });

  it('honours restS option', () => {
    let s = initSession(plan([['squat_chair', 2, 30]]), lookup, 0, { restS: 5 });
    s = doHold(reduceSession(s, { type: 'CALIBRATED' }), 1000);
    expect(s.restUntil).toBe(6000);
  });

  it('re-enters framing when the camera view changes', () => {
    let s = initSession(plan([['squat_chair', 1, 30], ['straddle_x', 1, 30], ['fold_knees', 1, 30]]), lookup, 0);
    s = doHold(reduceSession(s, { type: 'CALIBRATED' }), 0);
    s = reduceSession(s, { type: 'TICK', now: 15_000 });
    expect(s.phase).toBe('framing');
    expect(currentStep(s)!.stretchId).toBe('straddle_x');
    s = doHold(s, 20_000);
    s = reduceSession(s, { type: 'TICK', now: 40_000 });
    expect(s.phase).toBe('framing');
    expect(currentStep(s)!.stretchId).toBe('fold_knees');
  });

  it('HURT records the attempt and skips remaining steps of that stretch', () => {
    let s = initSession(plan([['couch_stretch', 2, 30], ['squat_chair', 1, 30]]), lookup, 0);
    s = red(s, { type: 'CALIBRATED' }, { type: 'FRAMING_OK' }, { type: 'START_HOLD' });
    s = reduceSession(s, { type: 'HURT', attempt: attempt('couch_stretch', true), now: 5000 });
    expect(s.phase).toBe('rest');
    expect(s.attempts.length).toBe(1);
    expect(s.attempts[0].hurt).toBe(true);
    expect(s.skippedStretchIds).toEqual(['couch_stretch']);
    s = reduceSession(s, { type: 'TICK', now: 20_000 });
    expect(currentStep(s)!.stretchId).toBe('squat_chair');
    expect(s.stepIndex).toBe(4);
  });

  it('HURT on the last remaining stretch goes to summary', () => {
    let s = initSession(plan([['squat_chair', 3, 30]]), lookup, 0);
    s = red(s, { type: 'CALIBRATED' }, { type: 'FRAMING_OK' }, { type: 'START_HOLD' });
    s = reduceSession(s, { type: 'HURT', attempt: attempt('squat_chair', true), now: 5000 });
    expect(s.phase).toBe('summary');
  });

  it('SKIP moves on without an attempt', () => {
    let s = initSession(plan([['squat_chair', 1, 30], ['fold_knees', 1, 30]]), lookup, 0);
    s = red(s, { type: 'CALIBRATED' }, { type: 'FRAMING_OK' });
    s = reduceSession(s, { type: 'SKIP', now: 100 });
    expect(s.phase).toBe('instructions');
    expect(currentStep(s)!.stretchId).toBe('fold_knees');
    expect(s.attempts.length).toBe(0);
    s = red(s, { type: 'START_HOLD' }, { type: 'SKIP', now: 200 });
    expect(s.phase).toBe('summary');
    expect(s.attempts.length).toBe(0);
  });

  it('ABORT goes to aborted from any active phase', () => {
    let s = initSession(plan([['squat_chair', 1, 30]]), lookup, 0);
    expect(reduceSession(s, { type: 'ABORT' }).phase).toBe('aborted');
    s = red(s, { type: 'CALIBRATED' }, { type: 'FRAMING_OK' }, { type: 'START_HOLD' }, { type: 'ABORT' });
    expect(s.phase).toBe('aborted');
    expect(currentStep(s)).toBeNull();
  });

  it('irrelevant events return the same object', () => {
    const s = initSession(plan([['squat_chair', 2, 30]]), lookup, 0);
    const evs: SessionEvent[] = [
      { type: 'FRAMING_OK' }, { type: 'START_HOLD' }, { type: 'TICK', now: 99 },
      { type: 'HOLD_DONE', attempt: attempt('squat_chair'), now: 1 }, { type: 'HURT', attempt: attempt('squat_chair'), now: 1 },
      { type: 'SKIP', now: 1 },
    ];
    for (const e of evs) expect(reduceSession(s, e)).toBe(s);
    const f = reduceSession(s, { type: 'CALIBRATED' });
    expect(reduceSession(f, { type: 'CALIBRATED' })).toBe(f);
    expect(reduceSession(f, { type: 'START_HOLD' })).toBe(f);
    const done = red(f, { type: 'SKIP', now: 0 }, { type: 'SKIP', now: 0 });
    expect(done.phase).toBe('summary');
    expect(reduceSession(done, { type: 'ABORT' })).toBe(done);
  });

  it('is pure (never mutates input)', () => {
    let s = initSession(plan([['couch_stretch', 1, 30], ['squat_chair', 1, 30]]), lookup, 0);
    const events: SessionEvent[] = [
      { type: 'CALIBRATED' }, { type: 'FRAMING_OK' }, { type: 'START_HOLD' },
      { type: 'HURT', attempt: attempt('couch_stretch', true), now: 10 }, { type: 'TICK', now: 100_000 },
      { type: 'START_HOLD' }, { type: 'HOLD_DONE', attempt: attempt('squat_chair'), now: 200_000 },
    ];
    for (const e of events) {
      const snap = JSON.stringify(s);
      deepFreeze(s);
      const n = reduceSession(s, e);
      expect(JSON.stringify(s)).toBe(snap);
      s = n;
    }
    expect(s.phase).toBe('summary');
  });

  it('empty plan goes to summary after calibration', () => {
    const s = initSession(plan([]), lookup, 0);
    expect(reduceSession(s, { type: 'CALIBRATED' }).phase).toBe('summary');
  });
});

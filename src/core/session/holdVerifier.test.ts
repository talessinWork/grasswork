import { describe, it, expect } from 'bun:test';
import type { EvalResult } from '../types';
import { createHoldVerifier, toAttempt, type HoldVerifier, type HoldState } from './holdVerifier';

function ev(t: number, p: Partial<EvalResult> = {}): EvalResult {
  const valid = p.valid ?? false;
  return {
    t,
    visible: true,
    orientationOk: true,
    valid,
    failed: [],
    cues: [],
    depth: valid ? 0 : null,
    metrics: {},
    standing: false,
    ...p,
  };
}
const standing = (t: number) => ev(t, { standing: true, valid: false });
const valid = (t: number, depth = 0) => ev(t, { valid: true, depth });
const invalid = (t: number, failed: string[] = ['r1']) => ev(t, { valid: false, failed });

/** push frames every stepMs from t0 (inclusive) to t1 (exclusive) */
function run(h: HoldVerifier, t0: number, t1: number, make: (t: number) => EvalResult, stepMs = 50): HoldState {
  let s = h.state();
  for (let t = t0; t < t1; t += stepMs) s = h.push(make(t));
  return s;
}

/** stand, then enter; returns time holding started */
function enter(h: HoldVerifier): number {
  h.push(standing(0));
  run(h, 100, 600, valid); // valid from 100..550
  const s = h.push(valid(600)); // 500 ms after 100
  expect(s.phase).toBe('holding');
  return 600;
}

describe('holdVerifier', () => {
  it('requires standing before entry', () => {
    const h = createHoldVerifier({ targetS: 10, depthBetter: 'higher' });
    expect(h.state().phase).toBe('await_standing');
    let s = run(h, 0, 2000, valid);
    expect(s.phase).toBe('await_standing');
    expect(s.heldMs).toBe(0);
    s = h.push(ev(2000, { standing: true, visible: false }));
    expect(s.phase).toBe('await_standing');
    s = h.push(standing(2050));
    expect(s.phase).toBe('await_entry');
    expect(s.enteredFromStanding).toBe(true);
  });

  it('starts the hold only after 500 ms of continuous validity', () => {
    const h = createHoldVerifier({ targetS: 10, depthBetter: 'higher' });
    h.push(standing(0));
    let s = run(h, 100, 500, valid); // 100..450
    expect(s.phase).toBe('await_entry');
    s = h.push(invalid(500)); // breaks the run
    s = run(h, 550, 1000, valid); // 550..950 = 400ms
    expect(s.phase).toBe('await_entry');
    s = h.push(valid(1050)); // 500 ms after 550
    expect(s.phase).toBe('holding');
    expect(s.heldMs).toBe(0);
    expect(s.totalFrames).toBe(1);
  });

  it('requireEntry false skips standing', () => {
    const h = createHoldVerifier({ targetS: 10, depthBetter: 'higher', requireEntry: false });
    expect(h.state().phase).toBe('await_entry');
    const s = run(h, 0, 550, valid);
    expect(s.phase).toBe('holding');
    expect(s.enteredFromStanding).toBe(false);
  });

  it('short jitter dropouts do not pause and add no time', () => {
    const h = createHoldVerifier({ targetS: 10, depthBetter: 'higher' });
    const t0 = enter(h);
    let s = run(h, t0 + 50, t0 + 1050, valid); // 1000 ms
    expect(s.heldMs).toBe(1000);
    s = run(h, t0 + 1050, t0 + 1450, invalid); // 400 ms of invalid frames
    expect(s.phase).toBe('holding');
    expect(s.heldMs).toBe(1000);
    s = h.push(valid(t0 + 1450));
    expect(s.phase).toBe('holding');
    expect(s.heldMs).toBe(1000);
    s = h.push(valid(t0 + 1500));
    expect(s.heldMs).toBe(1050);
  });

  it('long dropout pauses, then resumes on valid without re-entry', () => {
    const h = createHoldVerifier({ targetS: 10, depthBetter: 'higher' });
    const t0 = enter(h);
    run(h, t0 + 50, t0 + 1050, valid);
    let s = run(h, t0 + 1050, t0 + 2000, invalid);
    expect(s.phase).toBe('paused');
    expect(s.heldMs).toBe(1000);
    s = h.push(valid(t0 + 2000));
    expect(s.phase).toBe('holding');
    s = run(h, t0 + 2050, t0 + 2550, valid);
    expect(s.heldMs).toBe(1500);
  });

  it('clamps large frame gaps', () => {
    const h = createHoldVerifier({ targetS: 10, depthBetter: 'higher' });
    const t0 = enter(h);
    const s = h.push(valid(t0 + 5000));
    expect(s.heldMs).toBe(400);
    expect(s.phase).toBe('holding');
  });

  it('keeps real time at a slow ~3 fps detection rate', () => {
    const h = createHoldVerifier({ targetS: 10, depthBetter: 'higher' });
    const t0 = enter(h);
    let s = h.push(valid(t0 + 333));
    s = h.push(valid(t0 + 666));
    s = h.push(valid(t0 + 999));
    expect(s.heldMs).toBe(999);
  });

  it('completes at target and stays complete', () => {
    const h = createHoldVerifier({ targetS: 2, depthBetter: 'higher' });
    const t0 = enter(h);
    let s = run(h, t0 + 50, t0 + 2000, valid);
    expect(s.phase).toBe('holding');
    s = h.push(valid(t0 + 2000));
    expect(s.phase).toBe('complete');
    expect(s.heldMs).toBe(2000);
    expect(s.progress).toBe(1);
    s = h.push(valid(t0 + 2050));
    expect(s.heldMs).toBe(2000);
    expect(s.totalFrames).toBe(41);
  });

  it('tracks bestDepth for higher-is-better', () => {
    const h = createHoldVerifier({ targetS: 10, depthBetter: 'higher' });
    const t0 = enter(h);
    h.push(valid(t0 + 50, 0.2));
    h.push(valid(t0 + 100, 0.5));
    h.push(ev(t0 + 150, { valid: false, depth: 0.9 })); // invalid frames ignored
    const s = h.push(valid(t0 + 200, 0.3));
    expect(s.bestDepth).toBe(0.5);
  });

  it('tracks bestDepth for lower-is-better', () => {
    const h = createHoldVerifier({ targetS: 10, depthBetter: 'lower' });
    const t0 = enter(h);
    h.push(valid(t0 + 50, 0.2));
    h.push(valid(t0 + 100, -0.1));
    h.push(ev(t0 + 150, { valid: false, depth: -0.9 }));
    const s = h.push(valid(t0 + 200, 0.1));
    expect(s.bestDepth).toBe(-0.1);
  });

  it('counts validRatio frames and failedRules since holding started', () => {
    const h = createHoldVerifier({ targetS: 10, depthBetter: 'higher' });
    h.push(invalid(0, ['pre'])); // before standing: not counted
    const t0 = enter(h);
    h.push(invalid(t0 + 50, ['a', 'b']));
    h.push(invalid(t0 + 100, ['a']));
    const s = h.push(valid(t0 + 150));
    expect(s.totalFrames).toBe(4);
    expect(s.validFrames).toBe(2);
    expect(s.failedRules).toEqual({ a: 2, b: 1 });
  });

  it('state() returns a copy and reset() restarts', () => {
    const h = createHoldVerifier({ targetS: 10, depthBetter: 'higher' });
    const t0 = enter(h);
    h.push(invalid(t0 + 50, ['a']));
    const s = h.state();
    s.failedRules.a = 99;
    expect(h.state().failedRules.a).toBe(1);
    h.reset();
    expect(h.state().phase).toBe('await_standing');
    expect(h.state().totalFrames).toBe(0);
  });
});

describe('toAttempt', () => {
  it('maps state and meta', () => {
    const state: HoldState = {
      phase: 'complete',
      heldMs: 30_049,
      targetMs: 30_000,
      progress: 1,
      bestDepth: 0.4,
      validFrames: 3,
      totalFrames: 4,
      failedRules: { a: 1 },
      enteredFromStanding: true,
    };
    const a = toAttempt(state, { id: 'x', sessionId: 's', stretchId: 'deep_squat', side: null, startedAt: 1, endedAt: 2, hurt: false });
    expect(a).toEqual({
      id: 'x', sessionId: 's', stretchId: 'deep_squat', side: null, startedAt: 1, endedAt: 2,
      heldS: 30, targetS: 30, bestDepth: 0.4, validRatio: 0.75, failedRules: { a: 1 }, completed: true, hurt: false,
    });
    const b = toAttempt({ ...state, phase: 'paused', heldMs: 12_350, totalFrames: 0, validFrames: 0 }, { id: 'y', sessionId: 's', stretchId: 'couch_stretch', side: 'left', startedAt: 1, endedAt: 2, hurt: true });
    expect(b.heldS).toBe(12.4);
    expect(b.completed).toBe(false);
    expect(b.validRatio).toBe(0);
    expect(b.hurt).toBe(true);
    expect(b.side).toBe('left');
  });
});

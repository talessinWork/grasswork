import { describe, it, expect } from 'bun:test';
import { depthScore, levelFor, xpForAttempt, xpToNext } from './xp';
import { attempt, specLookup } from '../progression/testFixtures';

const curb = specLookup('squat_curb'); // higher better, target 0
const floor = specLookup('fold_floor'); // lower better, target 0

describe('xpForAttempt', () => {
  it('gives round(heldS * depthScore) and a PB for the first depth', () => {
    const ev = xpForAttempt(attempt({ id: 'x', heldS: 30, bestDepth: 0 }), curb, null, 123);
    expect(ev).toEqual([
      { id: 'x#hold', at: 123, source: 'hold', amount: 30, ref: 'x' },
      { id: 'x#pb', at: 123, source: 'personal_best', amount: 40, ref: 'x' },
    ]);
  });
  it('no PB without improvement, PB when better (both directions)', () => {
    expect(xpForAttempt(attempt({ bestDepth: 0.1 }), curb, 0.1, 0).map((e) => e.source)).toEqual(['hold']);
    expect(xpForAttempt(attempt({ bestDepth: 0.2 }), curb, 0.1, 0).map((e) => e.source)).toEqual(['hold', 'personal_best']);
    expect(xpForAttempt(attempt({ bestDepth: -0.1 }), floor, 0, 0).map((e) => e.source)).toEqual(['hold', 'personal_best']);
    expect(xpForAttempt(attempt({ bestDepth: 0.1 }), floor, 0, 0).map((e) => e.source)).toEqual(['hold']);
  });
  it('no PB when bestDepth is null', () => {
    expect(xpForAttempt(attempt({ bestDepth: null }), curb, null, 0).map((e) => e.source)).toEqual(['hold']);
  });
  it('no xp for very short or half-failed holds', () => {
    expect(xpForAttempt(attempt({ heldS: 4, completed: true, targetS: 4 }), curb, null, 0)).toEqual([]);
    expect(xpForAttempt(attempt({ heldS: 14, targetS: 30, completed: false, bestDepth: 1 }), curb, null, 0)).toEqual([]);
    expect(xpForAttempt(attempt({ heldS: 15, targetS: 30, completed: false }), curb, null, 0)).toHaveLength(1);
  });
  it('depthScore is clamped to [0.5, 2] and respects direction', () => {
    expect(depthScore(curb, 5)).toBe(2);
    expect(depthScore(curb, -5)).toBe(0.5);
    expect(depthScore(curb, 0)).toBe(1);
    expect(depthScore(floor, -0.5)).toBe(1.5);
    expect(depthScore(floor, 0.5)).toBe(0.5);
    expect(depthScore(curb, null)).toBe(1);
    expect(xpForAttempt(attempt({ heldS: 40, bestDepth: 9 }), curb, 10, 0)[0].amount).toBe(80);
    expect(xpForAttempt(attempt({ heldS: 40, bestDepth: -9 }), curb, -8, 0)[0].amount).toBe(20);
  });
});

describe('levelFor', () => {
  it('level 1 at 0 xp, level 2 at 300, +20% per level', () => {
    expect(levelFor(0)).toEqual({ level: 1, intoLevel: 0, forNext: 300, total: 0 });
    expect(levelFor(299).level).toBe(1);
    expect(levelFor(300)).toEqual({ level: 2, intoLevel: 0, forNext: 360, total: 300 });
    expect(levelFor(659).level).toBe(2);
    expect(levelFor(660)).toEqual({ level: 3, intoLevel: 0, forNext: 432, total: 660 });
    expect(levelFor(700)).toEqual({ level: 3, intoLevel: 40, forNext: 432, total: 700 });
    expect(xpToNext(4)).toBe(518);
  });
  it('handles negatives', () => {
    expect(levelFor(-5).level).toBe(1);
  });
});

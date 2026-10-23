import { describe, it, expect } from 'bun:test';
import { evaluatePromotion } from './promotion';
import { specsForGoal } from './testFixtures';
import type { GoalRecord, TestResultRecord } from '../types';

const squat: GoalRecord = { goalId: 'deep_squat', currentStretchId: 'squat_curb', status: 'active', startedAt: 0 };
const fold: GoalRecord = { goalId: 'forward_fold', currentStretchId: 'fold_ankles', status: 'active', startedAt: 0 };
let n = 0;
const t = (g: GoalRecord, depth: number, date: string, stretchId = g.currentStretchId): TestResultRecord => ({
  id: `t${n++}`, goalId: g.goalId, stretchId, date, bestDepth: depth,
});

describe('evaluatePromotion', () => {
  it('promotes after two consecutive tests at target (higher better)', () => {
    const r = evaluatePromotion(squat, [t(squat, -0.1, '2026-10-02'), t(squat, 0, '2026-10-09'), t(squat, 0.05, '2026-10-16')], specsForGoal);
    expect(r).toEqual({ promote: true, nextStretchId: 'deep_squat', plateau: false });
  });

  it('needs the last two in a row', () => {
    expect(evaluatePromotion(squat, [t(squat, 0.1, '2026-10-02')], specsForGoal).promote).toBe(false);
    expect(evaluatePromotion(squat, [t(squat, 0.1, '2026-10-02'), t(squat, -0.1, '2026-10-09')], specsForGoal).promote).toBe(false);
    expect(evaluatePromotion(squat, [t(squat, 0.1, '2026-10-02'), t(squat, -0.1, '2026-10-09'), t(squat, 0.1, '2026-10-16')], specsForGoal).promote).toBe(false);
  });

  it('respects depthBetter lower', () => {
    expect(evaluatePromotion(fold, [t(fold, 0.3, '2026-10-02'), t(fold, 0.25, '2026-10-09')], specsForGoal)).toEqual({
      promote: true, nextStretchId: 'fold_floor', plateau: false,
    });
    expect(evaluatePromotion(fold, [t(fold, 0.35, '2026-10-02'), t(fold, 0.31, '2026-10-09')], specsForGoal).promote).toBe(false);
  });

  it('only uses tests on the current stretch and orders by date', () => {
    const tests = [t(squat, 0.5, '2026-10-02', 'squat_heels_raised'), t(squat, 0.1, '2026-10-16'), t(squat, 0.5, '2026-10-09', 'squat_heels_raised')];
    expect(evaluatePromotion(squat, tests, specsForGoal).promote).toBe(false);
    const ordered = [t(squat, 0.1, '2026-10-16'), t(squat, -0.3, '2026-10-02'), t(squat, 0.0, '2026-10-09')];
    expect(evaluatePromotion(squat, ordered, specsForGoal).promote).toBe(true);
  });

  it('never promotes at the top level', () => {
    const top: GoalRecord = { ...squat, currentStretchId: 'deep_squat' };
    const r = evaluatePromotion(top, [t(top, 0.5, '2026-10-02'), t(top, 0.5, '2026-10-09')], specsForGoal);
    expect(r.promote).toBe(false);
    expect(r.nextStretchId).toBeNull();
  });

  it('detects a plateau: last 3 weeks no better than the best before', () => {
    const tests = [
      t(squat, -0.1, '2026-09-25'),
      t(squat, -0.15, '2026-10-02'),
      t(squat, -0.1, '2026-10-09'),
      t(squat, -0.12, '2026-10-16'),
    ];
    expect(evaluatePromotion(squat, tests, specsForGoal).plateau).toBe(true);
  });

  it('no plateau when improving or with fewer than 3 tests', () => {
    expect(evaluatePromotion(squat, [t(squat, -0.3, '2026-10-02'), t(squat, -0.3, '2026-10-09')], specsForGoal).plateau).toBe(false);
    const improving = [t(squat, -0.3, '2026-09-25'), t(squat, -0.3, '2026-10-02'), t(squat, -0.3, '2026-10-09'), t(squat, -0.25, '2026-10-16')];
    expect(evaluatePromotion(squat, improving, specsForGoal).plateau).toBe(false);
  });

  it('plateau with exactly 3 tests compares the last 2 to the first (lower better)', () => {
    expect(evaluatePromotion(fold, [t(fold, 0.5, '2026-10-02'), t(fold, 0.5, '2026-10-09'), t(fold, 0.55, '2026-10-16')], specsForGoal).plateau).toBe(true);
    expect(evaluatePromotion(fold, [t(fold, 0.5, '2026-10-02'), t(fold, 0.5, '2026-10-09'), t(fold, 0.45, '2026-10-16')], specsForGoal).plateau).toBe(false);
  });
});

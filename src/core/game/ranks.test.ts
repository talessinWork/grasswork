import { describe, it, expect } from 'bun:test';
import { rankProgress } from './ranks';
import { specsForGoal } from '../progression/testFixtures';
import type { GoalRecord, TestResultRecord } from '../types';

const g = (cur: string): GoalRecord => ({ goalId: 'deep_squat', currentStretchId: cur, status: 'active', startedAt: 0 });
const t = (stretchId: string, depth: number, date: string): TestResultRecord => ({ id: date + stretchId, goalId: 'deep_squat', stretchId, date, bestDepth: depth });

describe('rankProgress', () => {
  it('no tests: null rank, next is the first rank, progress 0', () => {
    expect(rankProgress(g('squat_chair'), [], specsForGoal, 'Deep squat')).toEqual({
      goalId: 'deep_squat', goalName: 'Deep squat', currentRank: null, nextRank: 'Chair', progress: 0, currentStretchId: 'squat_chair',
    });
  });
  it('tests below the first level keep rank null with progress 0', () => {
    const r = rankProgress(g('squat_chair'), [t('squat_chair', -0.6, '2026-10-02')], specsForGoal, 'x');
    expect(r.currentRank).toBeNull();
    expect(r.progress).toBe(0);
  });
  it('interpolates between the reached level and the next target', () => {
    // reached Bench (-0.2) on heels_raised; now on curb (target 0), latest -0.1 → halfway
    const tests = [t('squat_heels_raised', -0.2, '2026-10-02'), t('squat_heels_raised', -0.15, '2026-10-09'), t('squat_curb', -0.1, '2026-10-16')];
    const r = rankProgress(g('squat_curb'), tests, specsForGoal, 'x');
    expect(r.currentRank).toBe('Bench');
    expect(r.nextRank).toBe('Curb');
    expect(r.progress).toBeCloseTo(0.5);
  });
  it('clamps progress', () => {
    const r = rankProgress(g('squat_curb'), [t('squat_heels_raised', -0.2, '2026-10-02'), t('squat_curb', -0.5, '2026-10-09')], specsForGoal, 'x');
    expect(r.progress).toBe(0);
  });
  it('top rank reached: nextRank null, progress 1', () => {
    const r = rankProgress(g('deep_squat'), [t('deep_squat', 0.3, '2026-10-02')], specsForGoal, 'x');
    expect(r.currentRank).toBe('Grass');
    expect(r.nextRank).toBeNull();
    expect(r.progress).toBe(1);
  });
  it('rank never goes down after a worse later test', () => {
    const r = rankProgress(g('squat_curb'), [t('squat_curb', 0.05, '2026-10-02'), t('squat_curb', -0.3, '2026-10-09')], specsForGoal, 'x');
    expect(r.currentRank).toBe('Curb');
    expect(r.nextRank).toBe('Grass');
  });
  it('works for lower-is-better goals', () => {
    const fg: GoalRecord = { goalId: 'forward_fold', currentStretchId: 'fold_ankles', status: 'active', startedAt: 0 };
    const tests: TestResultRecord[] = [
      { id: '1', goalId: 'forward_fold', stretchId: 'fold_shins', date: '2026-10-02', bestDepth: 0.6 },
      { id: '2', goalId: 'forward_fold', stretchId: 'fold_ankles', date: '2026-10-09', bestDepth: 0.4 },
    ];
    const r = rankProgress(fg, tests, specsForGoal, 'Fold');
    expect(r.currentRank).toBe('Shins');
    expect(r.nextRank).toBe('Ankles');
    expect(r.progress).toBeCloseTo(2 / 3);
  });
});

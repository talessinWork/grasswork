/** Level promotion and plateau detection from weekly test results. Pure. */
import type { GoalId, GoalRecord, StretchSpec, TestResultRecord } from '../types';

export interface PromotionResult {
  promote: boolean;
  nextStretchId: string | null;
  plateau: boolean;
}

/** true when `a` is strictly deeper than `b` for this spec */
export function isDeeper(spec: StretchSpec, a: number, b: number): boolean {
  return spec.depthBetter === 'higher' ? a > b : a < b;
}

/** true when depth reaches the spec's targetDepth */
export function reachesTarget(spec: StretchSpec, depth: number): boolean {
  return spec.depthBetter === 'higher' ? depth >= spec.targetDepth : depth <= spec.targetDepth;
}

function bestOf(spec: StretchSpec, depths: number[]): number {
  return depths.reduce((best, d) => (isDeeper(spec, d, best) ? d : best));
}

export function evaluatePromotion(
  goal: GoalRecord,
  tests: TestResultRecord[],
  specsForGoal: (g: GoalId) => StretchSpec[],
): PromotionResult {
  const ladder = [...specsForGoal(goal.goalId)].sort((a, b) => a.level - b.level);
  const idx = ladder.findIndex((s) => s.id === goal.currentStretchId);
  if (idx < 0) return { promote: false, nextStretchId: null, plateau: false };
  const spec = ladder[idx];
  const next = ladder[idx + 1] ?? null;

  const mine = tests
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.goalId === goal.goalId && t.stretchId === goal.currentStretchId)
    .sort((a, b) => (a.t.date < b.t.date ? -1 : a.t.date > b.t.date ? 1 : a.i - b.i))
    .map(({ t }) => t.bestDepth);

  const n = mine.length;
  const lastTwoReached = n >= 2 && reachesTarget(spec, mine[n - 1]) && reachesTarget(spec, mine[n - 2]);
  const promote = lastTwoReached && next !== null;

  let plateau = false;
  if (!promote && n >= 3) {
    // window = last 3 tests (last 2 when there are exactly 3, so there is a baseline before it)
    const windowSize = n > 3 ? 3 : 2;
    const baseline = bestOf(spec, mine.slice(0, n - windowSize));
    plateau = !mine.slice(n - windowSize).some((d) => isDeeper(spec, d, baseline));
  }

  return { promote, nextStretchId: promote && next ? next.id : null, plateau };
}

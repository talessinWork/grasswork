/** Rank ladder progress per goal from weekly test results. Pure. */
import type { GoalId, GoalRecord, StretchSpec, TestResultRecord } from '../types';
import type { RankProgress } from '../../services/contract';

function reaches(spec: StretchSpec, depth: number): boolean {
  return spec.depthBetter === 'higher' ? depth >= spec.targetDepth : depth <= spec.targetDepth;
}

export function rankProgress(
  goal: GoalRecord,
  tests: TestResultRecord[],
  specsForGoal: (g: GoalId) => StretchSpec[],
  goalName: string,
): RankProgress {
  const ladder = [...specsForGoal(goal.goalId)].sort((a, b) => a.level - b.level);
  const mine = tests
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.goalId === goal.goalId)
    .sort((a, b) => (a.t.date < b.t.date ? -1 : a.t.date > b.t.date ? 1 : a.i - b.i))
    .map(({ t }) => t);

  // highest ladder index whose target was reached in a test on that stretch
  let reachedIdx = -1;
  for (const t of mine) {
    const i = ladder.findIndex((s) => s.id === t.stretchId);
    if (i > reachedIdx && reaches(ladder[i], t.bestDepth)) reachedIdx = i;
  }

  const currentRank = reachedIdx >= 0 ? ladder[reachedIdx].rank : null;
  const nextSpec = ladder[reachedIdx + 1] ?? null;
  const nextRank = nextSpec ? nextSpec.rank : null;

  let progress = 0;
  const latest = [...mine].reverse().find((t) => t.stretchId === goal.currentStretchId);
  if (!nextSpec) {
    progress = reachedIdx >= 0 ? 1 : 0;
  } else if (latest) {
    const to = nextSpec.targetDepth;
    const from = reachedIdx >= 0 ? ladder[reachedIdx].targetDepth : null;
    if (reaches(nextSpec, latest.bestDepth)) progress = 1;
    else if (from === null || from === to) progress = 0;
    else progress = Math.min(1, Math.max(0, (latest.bestDepth - from) / (to - from)));
  }

  return { goalId: goal.goalId, goalName, currentRank, nextRank, progress, currentStretchId: goal.currentStretchId };
}

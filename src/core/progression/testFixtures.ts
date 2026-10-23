/** Small StretchSpec fixtures following the stretch-id table, for progression/game tests only. */
import type { AttemptRecord, GoalId, StretchSpec } from '../types';

function spec(p: Partial<StretchSpec> & Pick<StretchSpec, 'id' | 'goalId' | 'level'>): StretchSpec {
  return {
    rank: null,
    name: p.id,
    view: 'side',
    perSide: false,
    required: [],
    rules: [],
    depthMetric: 'hipBelowKnee',
    depthBetter: 'higher',
    targetDepth: 0,
    defaultHoldS: 30,
    instructions: '',
    ...p,
  };
}

// deep squat: hipBelowKnee, higher is deeper
const SQUAT = ['squat_chair', 'squat_heels_raised', 'squat_curb', 'deep_squat'].map((id, i) =>
  spec({ id, goalId: 'deep_squat', level: i, rank: ['Chair', 'Bench', 'Curb', 'Grass'][i], targetDepth: [-0.4, -0.2, 0, 0.2][i] }),
);
// forward fold: fingertipToFloor, lower is deeper
const FOLD = ['fold_knees', 'fold_shins', 'fold_ankles', 'fold_floor', 'fold_palms'].map((id, i) =>
  spec({
    id,
    goalId: 'forward_fold',
    level: i,
    rank: ['Knees', 'Shins', 'Ankles', 'Floor', 'Palms'][i],
    depthMetric: 'fingertipToFloor',
    depthBetter: 'lower',
    targetDepth: [1, 0.6, 0.3, 0, -0.2][i],
    view: 'side',
  }),
);
const SUPPORT = [
  spec({ id: 'couch_stretch', goalId: null, level: 0, perSide: true, depthMetric: 'backThighVertical', depthBetter: 'lower', targetDepth: 20 }),
  spec({ id: 'squat_sit', goalId: null, level: 0 }),
];

export const TEST_SPECS: StretchSpec[] = [...SQUAT, ...FOLD, ...SUPPORT];

export function specLookup(id: string): StretchSpec {
  const s = TEST_SPECS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown spec ${id}`);
  return s;
}

export function specsForGoal(g: GoalId): StretchSpec[] {
  return TEST_SPECS.filter((s) => s.goalId === g).sort((a, b) => a.level - b.level);
}

export function attempt(p: Partial<AttemptRecord>): AttemptRecord {
  return {
    id: 'a1',
    sessionId: 's1',
    stretchId: 'squat_curb',
    side: null,
    startedAt: 0,
    endedAt: 0,
    heldS: 30,
    targetS: 30,
    bestDepth: null,
    validRatio: 1,
    failedRules: {},
    completed: true,
    hurt: false,
    ...p,
  };
}

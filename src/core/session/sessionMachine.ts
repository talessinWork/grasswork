/** Pure reducer for the guided session flow. */
import type { AttemptRecord, CameraView, DayPlan, Side, StretchSpec } from '../types';

export type SessionPhase = 'calibrating' | 'framing' | 'instructions' | 'holding' | 'rest' | 'summary' | 'aborted';

export interface SessionStep {
  itemIndex: number;
  /** 1-based set number */
  set: number;
  side: Side | null;
  stretchId: string;
  holdS: number;
  /**
   * Camera view of the stretch (extension to CONTRACTS.md): the reducer has no spec lookup,
   * so it needs this to decide whether framing must be re-entered. Optional so steps built
   * elsewhere still type-check; buildSteps always sets it.
   */
  view?: CameraView;
}

export interface SessionState {
  phase: SessionPhase;
  plan: DayPlan;
  steps: SessionStep[];
  /** during 'rest' this still points at the step just finished */
  stepIndex: number;
  attempts: AttemptRecord[];
  restUntil: number | null;
  startedAt: number;
  skippedStretchIds: string[];
  /** rest length between steps, seconds (extension to CONTRACTS.md, from initSession opts) */
  restS?: number;
}

export type SessionEvent =
  | { type: 'CALIBRATED' }
  | { type: 'FRAMING_OK' }
  | { type: 'START_HOLD' }
  | { type: 'HOLD_DONE'; attempt: AttemptRecord; now: number }
  | { type: 'HURT'; attempt: AttemptRecord; now: number }
  | { type: 'SKIP'; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'ABORT' };

const SIDES: Side[] = ['left', 'right'];

export function buildSteps(plan: DayPlan, specLookup: (id: string) => StretchSpec): SessionStep[] {
  const steps: SessionStep[] = [];
  plan.items.forEach((item, itemIndex) => {
    const spec = specLookup(item.stretchId);
    const sides: (Side | null)[] = spec.perSide ? SIDES : [null];
    for (let set = 1; set <= item.sets; set++) {
      for (const side of sides) {
        steps.push({ itemIndex, set, side, stretchId: item.stretchId, holdS: item.holdS, view: spec.view });
      }
    }
  });
  return steps;
}

export function initSession(
  plan: DayPlan,
  specLookup: (id: string) => StretchSpec,
  now: number,
  opts?: { restS?: number },
): SessionState {
  return {
    phase: 'calibrating',
    plan,
    steps: buildSteps(plan, specLookup),
    stepIndex: 0,
    attempts: [],
    restUntil: null,
    startedAt: now,
    skippedStretchIds: [],
    restS: opts?.restS ?? 15,
  };
}

export function currentStep(state: SessionState): SessionStep | null {
  if (state.phase === 'summary' || state.phase === 'aborted') return null;
  return state.steps[state.stepIndex] ?? null;
}

/** index of the next step after `from` whose stretch isn't skipped, or -1 */
function nextIndex(steps: SessionStep[], from: number, skipped: string[]): number {
  for (let i = from + 1; i < steps.length; i++) {
    if (!skipped.includes(steps[i].stretchId)) return i;
  }
  return -1;
}

/** Move straight to the next step (or summary). */
function advance(state: SessionState): SessionState {
  const i = nextIndex(state.steps, state.stepIndex, state.skippedStretchIds);
  if (i < 0) return { ...state, phase: 'summary', restUntil: null };
  const prev = state.steps[state.stepIndex];
  const viewChanged = !prev || prev.view !== state.steps[i].view;
  return { ...state, stepIndex: i, phase: viewChanged ? 'framing' : 'instructions', restUntil: null };
}

/** After a hold ends: rest if another step follows, else summary. */
function finishHold(state: SessionState, now: number): SessionState {
  if (nextIndex(state.steps, state.stepIndex, state.skippedStretchIds) < 0) {
    return { ...state, phase: 'summary', restUntil: null };
  }
  return { ...state, phase: 'rest', restUntil: now + (state.restS ?? 15) * 1000 };
}

export function reduceSession(state: SessionState, ev: SessionEvent): SessionState {
  const { phase } = state;
  if (phase === 'summary' || phase === 'aborted') return state;

  switch (ev.type) {
    case 'ABORT':
      return { ...state, phase: 'aborted', restUntil: null };

    case 'CALIBRATED':
      if (phase !== 'calibrating') return state;
      if (state.steps.length === 0) return { ...state, phase: 'summary' };
      return { ...state, phase: 'framing' };

    case 'FRAMING_OK':
      return phase === 'framing' ? { ...state, phase: 'instructions' } : state;

    case 'START_HOLD':
      return phase === 'instructions' ? { ...state, phase: 'holding' } : state;

    case 'HOLD_DONE':
      if (phase !== 'holding') return state;
      return finishHold({ ...state, attempts: [...state.attempts, ev.attempt] }, ev.now);

    case 'HURT': {
      if (phase !== 'holding') return state;
      const stretchId = state.steps[state.stepIndex]?.stretchId;
      const skipped =
        stretchId == null || state.skippedStretchIds.includes(stretchId)
          ? state.skippedStretchIds
          : [...state.skippedStretchIds, stretchId];
      return finishHold({ ...state, attempts: [...state.attempts, ev.attempt], skippedStretchIds: skipped }, ev.now);
    }

    case 'SKIP':
      if (phase === 'framing' || phase === 'instructions' || phase === 'holding' || phase === 'rest') {
        return advance(state);
      }
      return state;

    case 'TICK':
      if (phase !== 'rest' || state.restUntil == null || ev.now < state.restUntil) return state;
      return advance(state);
  }
  return state;
}

/**
 * Hold verifier: turns a stream of per-frame EvalResults into a verified hold.
 *
 * Phases: await_standing -> await_entry -> holding <-> paused -> complete
 */
import type { AttemptRecord, EvalResult, Side } from '../types';

export type HoldPhase = 'await_standing' | 'await_entry' | 'holding' | 'paused' | 'complete';

export interface HoldState {
  phase: HoldPhase;
  heldMs: number;
  targetMs: number;
  /** heldMs / targetMs clamped to [0,1] */
  progress: number;
  bestDepth: number | null;
  validFrames: number;
  totalFrames: number;
  failedRules: Record<string, number>;
  enteredFromStanding: boolean;
}

export interface HoldVerifier {
  push(r: EvalResult): HoldState;
  state(): HoldState;
  reset(): void;
}

/** Frame gaps longer than this are clamped so a stalled camera can't add hold time. */
const MAX_FRAME_GAP_MS = 250;

export function createHoldVerifier(opts: {
  targetS: number;
  depthBetter: 'higher' | 'lower';
  startAfterMs?: number;
  dropoutMs?: number;
  requireEntry?: boolean;
}): HoldVerifier {
  const targetMs = Math.max(0, opts.targetS * 1000);
  const startAfterMs = opts.startAfterMs ?? 500;
  const dropoutMs = opts.dropoutMs ?? 700;
  const requireEntry = opts.requireEntry ?? true;
  const better = (a: number, b: number) => (opts.depthBetter === 'higher' ? a > b : a < b);

  let s: HoldState;
  /** t of the first frame of the current continuous valid run while awaiting entry */
  let validSince: number | null;
  /** t of the previous frame (any validity) since holding started */
  let lastT: number | null;
  /** was the previous frame valid (since holding started) */
  let lastValid: boolean;
  /** t of the last valid frame since holding started */
  let lastValidT: number | null;

  function initial(): HoldState {
    return {
      phase: requireEntry ? 'await_standing' : 'await_entry',
      heldMs: 0,
      targetMs,
      progress: 0,
      bestDepth: null,
      validFrames: 0,
      totalFrames: 0,
      failedRules: {},
      enteredFromStanding: false,
    };
  }

  function reset() {
    s = initial();
    validSince = null;
    lastT = null;
    lastValid = false;
    lastValidT = null;
  }
  reset();

  function snapshot(): HoldState {
    return { ...s, failedRules: { ...s.failedRules } };
  }

  /** Accounting for a frame once holding has started (holding / paused). */
  function account(r: EvalResult) {
    s.totalFrames += 1;
    for (const id of r.failed) s.failedRules[id] = (s.failedRules[id] ?? 0) + 1;

    const rawDt = lastT == null ? 0 : r.t - lastT;
    const dt = Math.min(Math.max(rawDt, 0), MAX_FRAME_GAP_MS);

    if (r.valid) {
      s.validFrames += 1;
      if (r.depth != null && (s.bestDepth == null || better(r.depth, s.bestDepth))) s.bestDepth = r.depth;
      // time only accrues between two consecutive valid frames
      if (s.phase === 'holding' && lastValid) s.heldMs += dt;
      if (s.phase === 'paused') s.phase = 'holding';
      lastValidT = r.t;
    } else if (s.phase === 'holding') {
      const since = lastValidT ?? lastT ?? r.t;
      if (r.t - since > dropoutMs) s.phase = 'paused';
    }

    lastT = r.t;
    lastValid = r.valid;

    if (s.heldMs >= targetMs) s.phase = 'complete';
    s.progress = targetMs > 0 ? Math.min(1, s.heldMs / targetMs) : 1;
  }

  function push(r: EvalResult): HoldState {
    switch (s.phase) {
      case 'complete':
        break;
      case 'await_standing':
        if (r.standing && r.visible) {
          s.phase = 'await_entry';
          s.enteredFromStanding = true;
        }
        break;
      case 'await_entry':
        if (r.valid) {
          if (validSince == null) validSince = r.t;
          if (r.t - validSince >= startAfterMs) {
            s.phase = 'holding';
            account(r);
          }
        } else {
          validSince = null;
        }
        break;
      case 'holding':
      case 'paused':
        account(r);
        break;
    }
    return snapshot();
  }

  return { push, state: snapshot, reset };
}

export function toAttempt(
  state: HoldState,
  meta: { id: string; sessionId: string; stretchId: string; side: Side | null; startedAt: number; endedAt: number; hurt: boolean },
): AttemptRecord {
  return {
    id: meta.id,
    sessionId: meta.sessionId,
    stretchId: meta.stretchId,
    side: meta.side,
    startedAt: meta.startedAt,
    endedAt: meta.endedAt,
    heldS: Math.round(state.heldMs / 100) / 10,
    targetS: state.targetMs / 1000,
    bestDepth: state.bestDepth,
    validRatio: state.totalFrames > 0 ? state.validFrames / state.totalFrames : 0,
    failedRules: { ...state.failedRules },
    completed: state.phase === 'complete',
    hurt: meta.hurt,
  };
}

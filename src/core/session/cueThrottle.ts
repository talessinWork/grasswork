/** Picks at most one spoken/displayed cue at a time, so the user isn't nagged every frame. */
import type { EvalResult } from '../types';

export interface CueThrottle {
  next(r: EvalResult, now: number): string | null;
  reset(): void;
}

export const OUT_OF_FRAME_CUE = 'Move into frame';

export function createCueThrottle(opts?: { minGapMs?: number; sameCueGapMs?: number }): CueThrottle {
  const minGapMs = opts?.minGapMs ?? 3000;
  const sameCueGapMs = opts?.sameCueGapMs ?? 6000;
  let lastAt: number | null = null;
  let saidAt = new Map<string, number>();

  function next(r: EvalResult, now: number): string | null {
    if (r.valid) return null;
    const candidates = r.visible ? r.cues : [OUT_OF_FRAME_CUE];
    if (candidates.length === 0) return null;
    if (lastAt != null && now - lastAt < minGapMs) return null;
    // first cue (most important) that wasn't said recently
    for (const cue of candidates) {
      const at = saidAt.get(cue);
      if (at != null && now - at < sameCueGapMs) continue;
      lastAt = now;
      saidAt.set(cue, now);
      return cue;
    }
    return null;
  }

  function reset() {
    lastAt = null;
    saidAt = new Map();
  }

  return { next, reset };
}

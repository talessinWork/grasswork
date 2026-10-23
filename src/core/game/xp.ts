/** XP for holds and the level curve. Pure. */
import type { AttemptRecord, StretchSpec, XpEvent } from '../types';

export const PB_XP = 40;
const MIN_HELD_S = 5;

function isDeeper(spec: StretchSpec, a: number, b: number): boolean {
  return spec.depthBetter === 'higher' ? a > b : a < b;
}

/**
 * Maps depth relative to spec.targetDepth into [0.5, 2]: at target → 1, each unit deeper/shallower
 * of the target's scale (|target| or 1, whichever is larger) adds/removes 1, clamped.
 */
export function depthScore(spec: StretchSpec, depth: number | null): number {
  if (depth === null || !Number.isFinite(depth)) return 1;
  const scale = Math.max(1, Math.abs(spec.targetDepth));
  const signed = spec.depthBetter === 'higher' ? depth - spec.targetDepth : spec.targetDepth - depth;
  return Math.min(2, Math.max(0.5, 1 + signed / scale));
}

export function xpForAttempt(a: AttemptRecord, spec: StretchSpec, prevBestDepth: number | null, now: number): XpEvent[] {
  if (a.heldS < MIN_HELD_S) return [];
  if (!a.completed && a.heldS < 0.5 * a.targetS) return [];
  const events: XpEvent[] = [
    { id: `${a.id}#hold`, at: now, source: 'hold', amount: Math.round(a.heldS * depthScore(spec, a.bestDepth)), ref: a.id },
  ];
  if (a.bestDepth !== null && (prevBestDepth === null || isDeeper(spec, a.bestDepth, prevBestDepth))) {
    events.push({ id: `${a.id}#pb`, at: now, source: 'personal_best', amount: PB_XP, ref: a.id });
  }
  return events;
}

/** xp needed to go from level n to n+1 */
export function xpToNext(level: number): number {
  return Math.round(300 * Math.pow(1.2, level - 1));
}

export function levelFor(totalXp: number): { level: number; intoLevel: number; forNext: number; total: number } {
  const total = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let remaining = total;
  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level);
    level++;
  }
  return { level, intoLevel: remaining, forNext: xpToNext(level), total };
}

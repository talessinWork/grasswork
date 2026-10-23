/** Small pure helpers for the services layer: display text, numbers, seeds, ids. */
import type { LocalDate, PlanItem, StretchSpec } from '../core/types';
import { SHIN_CM, THIGH_CM, TORSO_CM } from '../core/evaluator/specs/index';
import { weekday } from '../core/util';

/** Start of time for "all history" range queries. */
export const EPOCH_DATE: LocalDate = '0000-01-01';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** 'Mo', 'Tu', ... for a local date */
export function dayLabel(date: LocalDate): string {
  return DAY_LABELS[weekday(date)];
}

/** "2 × 40 s", "40 s", "30 s each side", "2 × 30 s each side" */
export function planDetail(item: PlanItem, spec: StretchSpec): string {
  const hold = `${item.holdS} s`;
  const base = item.sets > 1 ? `${item.sets} × ${hold}` : hold;
  return spec.perSide ? `${base} each side` : base;
}

/**
 * Depth metric value -> number in the goal's display unit (same conversion as formatDepth):
 * hipBelowKnee -> cm below knee (positive = below), fingertipToFloor -> cm to floor (negative = past the floor),
 * heelLift -> cm, hipHeight -> cm, angles -> degrees.
 */
export function depthToDisplay(spec: StretchSpec, depth: number): number {
  switch (spec.depthMetric) {
    case 'hipBelowKnee':
      return Math.round(depth * THIGH_CM);
    case 'fingertipToFloor':
    case 'heelLift':
      return Math.round(depth * SHIN_CM);
    case 'hipHeight':
      return Math.round(depth * TORSO_CM);
    default:
      return Math.round(depth);
  }
}

/** true when `a` is strictly deeper than `b` for this spec */
export function deeper(spec: StretchSpec, a: number, b: number): boolean {
  return spec.depthBetter === 'higher' ? a > b : a < b;
}

export function reaches(spec: StretchSpec, depth: number): boolean {
  return spec.depthBetter === 'higher' ? depth >= spec.targetDepth : depth <= spec.targetDepth;
}

/** FNV-1a 32-bit string hash */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Id generator that never touches the system clock; time comes from the caller. */
export function createIdMaker(random: () => number): (prefix: string, now: number) => string {
  let counter = 0;
  return (prefix, now) => {
    counter = (counter + 1) % 1_000_000;
    const r = Math.floor(random() * 2 ** 32).toString(36);
    return `${prefix}${Math.max(0, Math.floor(now)).toString(36)}${counter.toString(36)}${r}`;
  };
}

export function minutesPlanned(estimatedS: number): number {
  return Math.max(1, Math.round(estimatedS / 60));
}

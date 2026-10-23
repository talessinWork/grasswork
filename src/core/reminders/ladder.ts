/**
 * The 5-step "nag ladder": escalating reminder times relative to the user's session time.
 * Pure: no Date access, only 'HH:MM' arithmetic.
 */
import type { Settings } from '../types';
import { formatHHMM, parseHHMM } from '../util';

/** Minutes after sessionTime for each ladder step: T, T+4:45, T+10:15, T+13:15, T+14:45. */
export const LADDER_OFFSETS_MIN: readonly number[] = [0, 285, 615, 795, 885];

/** Raw minute-of-day for each step (may be >= 1440 when the ladder runs past midnight). */
export function ladderMinutes(settings: Settings): number[] {
  const t = parseHHMM(settings.sessionTime);
  return LADDER_OFFSETS_MIN.map((off) => t + off);
}

/**
 * Always 5 'HH:MM' times, index = step. Times past 23:59 are shown wrapped (formatHHMM);
 * planReminders drops those and the ones inside quiet hours.
 */
export function ladderTimes(settings: Settings): string[] {
  return ladderMinutes(settings).map((m) => formatHHMM(m));
}

/** true if minute-of-day `min` (0..1439) falls in [quietStart, quietEnd), which may span midnight. */
export function isQuietMinute(min: number, settings: Pick<Settings, 'quietStart' | 'quietEnd'>): boolean {
  const s = parseHHMM(settings.quietStart);
  const e = parseHHMM(settings.quietEnd);
  if (s === e) return false;
  if (s < e) return min >= s && min < e;
  return min >= s || min < e;
}

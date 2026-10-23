/** Weekly test scheduling helpers. Pure. */
import type { LocalDate, SessionRecord, Settings } from '../types';
import { daysBetween, weekday } from '../util';

/** Test weekday and no completed test session on that date yet. */
export function isTestDay(date: LocalDate, settings: Settings, sessions: SessionRecord[]): boolean {
  if (weekday(date) !== settings.testWeekday) return false;
  return !sessions.some((s) => s.date === date && s.kind === 'test' && s.completed);
}

/** 1-based week index since the first session (week 1 = days 0..6). */
export function weekNumber(firstSessionDate: LocalDate | null, date: LocalDate): number {
  if (!firstSessionDate) return 1;
  return Math.max(1, Math.floor(daysBetween(firstSessionDate, date) / 7) + 1);
}

/** Streak bookkeeping: day statuses, rolling, freezes and rest days. Pure. */
import type { DayStatus, LocalDate, StreakState } from '../types';
import { addDays, daysBetween, weekday } from '../util';

export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;

/** Status of each day in [from, today); today is included only once it is done/rest/frozen. */
export function dayStatuses(input: {
  today: LocalDate;
  doneDates: Set<LocalDate>;
  frozenDates: Set<LocalDate>;
  restDates: Set<LocalDate>;
  from: LocalDate;
}): Map<LocalDate, DayStatus> {
  const out = new Map<LocalDate, DayStatus>();
  for (let d = input.from; d <= input.today; d = addDays(d, 1)) {
    let s: DayStatus | null = null;
    if (input.doneDates.has(d)) s = 'done';
    else if (input.restDates.has(d)) s = 'rest';
    else if (input.frozenDates.has(d)) s = 'frozen';
    else if (d < input.today) s = 'missed';
    if (s) out.set(d, s);
  }
  return out;
}

function countDay(st: StreakState, date: LocalDate, earns: boolean): StreakState {
  const current = st.current + 1;
  let freezes = st.freezesBanked;
  if (earns && current % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
  return { ...st, current, longest: Math.max(st.longest, current), freezesBanked: freezes, lastCountedDate: date };
}

/**
 * Walks every day after state.lastCountedDate up to yesterday, then today if done/rest.
 * done/rest → +1; missed → spend a freeze (streak kept, day recorded in frozenDates) or reset to 0.
 * Idempotent: a second call with the same input changes nothing.
 */
export function rollStreak(
  state: StreakState,
  input: { today: LocalDate; doneDates: Set<LocalDate>; restDates: Set<LocalDate> },
): { state: StreakState; frozenDates: LocalDate[] } {
  const { today, doneDates, restDates } = input;
  let st: StreakState = { ...state };
  const frozenDates: LocalDate[] = [];

  let start: LocalDate;
  if (st.lastCountedDate === null) {
    // no history: start from the earliest done/rest day (missed days before any activity don't count)
    const all = [...doneDates, ...restDates].filter((d) => d <= today).sort();
    if (all.length === 0) return { state: st, frozenDates };
    start = all[0];
  } else {
    if (st.lastCountedDate >= today) return { state: st, frozenDates };
    start = addDays(st.lastCountedDate, 1);
  }

  for (let d = start; d < today; d = addDays(d, 1)) {
    if (doneDates.has(d)) st = countDay(st, d, true);
    else if (restDates.has(d)) st = countDay(st, d, true);
    else if (st.current > 0 && st.freezesBanked > 0) {
      st = { ...st, freezesBanked: st.freezesBanked - 1, lastCountedDate: d };
      frozenDates.push(d);
    } else {
      // missed: streak resets; lastCountedDate stays (it only marks done/frozen/rest days).
      // Re-walking these days later is harmless because current is already 0.
      st = { ...st, current: 0 };
    }
  }

  if (doneDates.has(today) || restDates.has(today)) st = countDay(st, today, true);
  return { state: st, frozenDates };
}

/** Monday of the week containing `date` */
export function weekStart(date: LocalDate): LocalDate {
  return addDays(date, -((weekday(date) + 6) % 7));
}

/** One rest day per Monday–Sunday week. */
export function canUseRestDay(state: StreakState, today: LocalDate): boolean {
  if (!state.restDayUsed) return true;
  const used = state.restDayUsed;
  const ws = weekStart(today);
  return !(used >= ws && daysBetween(ws, used) < 7);
}

/** Whole minutes (rounded up) until local midnight. */
export function minutesLeftToday(now: number): number {
  const d = new Date(now);
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
  return Math.max(0, Math.ceil((midnight - now) / 60_000));
}

/**
 * Streak persistence on top of Repo.getStreak/saveStreak.
 * StreakState only keeps the latest rest day, but the week strip needs past rest and frozen days,
 * so they ride along as extra fields in the same stored JSON object (both repos store the streak as JSON).
 * Screens only ever see the plain StreakState (extras stripped).
 */
import type { Repo } from '../core/repo';
import type { LocalDate, StreakState } from '../core/types';
import { rollStreak } from '../core/game/streak';
import { addDays } from '../core/util';
import { EPOCH_DATE } from './helpers';

export interface StoredStreak extends StreakState {
  restDates?: LocalDate[];
  frozenDates?: LocalDate[];
}

/** how long rest/frozen day history is kept */
const KEEP_DAYS = 120;

export function plainStreak(s: StoredStreak): StreakState {
  return {
    current: s.current,
    longest: s.longest,
    freezesBanked: s.freezesBanked,
    lastCountedDate: s.lastCountedDate,
    restDayUsed: s.restDayUsed,
  };
}

export interface StreakSnapshot {
  state: StoredStreak;
  doneDates: Set<LocalDate>;
  restDates: Set<LocalDate>;
  frozenDates: Set<LocalDate>;
}

/** Completed session dates from `from` up to `today`. */
export async function doneDatesSince(repo: Repo, from: LocalDate, today: LocalDate): Promise<Set<LocalDate>> {
  const sessions = await repo.listSessions(from, today);
  return new Set(sessions.filter((s) => s.completed).map((s) => s.date));
}

/**
 * Loads the stored streak, rolls it up to `today` (adding `extraRest` as a rest day if given) and persists it
 * when anything changed.
 */
export async function rollAndSave(repo: Repo, today: LocalDate, extraRest?: LocalDate): Promise<StreakSnapshot> {
  const stored = (await repo.getStreak()) as StoredStreak;
  const restList = new Set(stored.restDates ?? []);
  if (stored.restDayUsed) restList.add(stored.restDayUsed);
  if (extraRest) restList.add(extraRest);
  const frozenList = new Set(stored.frozenDates ?? []);

  const from = stored.lastCountedDate ?? EPOCH_DATE;
  const doneDates = await doneDatesSince(repo, from, today);
  const rolled = rollStreak(plainStreak(stored), { today, doneDates, restDates: restList });
  for (const d of rolled.frozenDates) frozenList.add(d);

  const cutoff = addDays(today, -KEEP_DAYS);
  const next: StoredStreak = {
    ...rolled.state,
    restDayUsed: extraRest ?? rolled.state.restDayUsed,
    restDates: [...restList].filter((d) => d >= cutoff).sort(),
    frozenDates: [...frozenList].filter((d) => d >= cutoff).sort(),
  };
  if (JSON.stringify(next) !== JSON.stringify(stored)) await repo.saveStreak(next);
  return { state: next, doneDates, restDates: restList, frozenDates: frozenList };
}

/**
 * Plans the local-notification queue (~12 days of nag ladders) and syncs it with the OS.
 * Pure planning; syncing goes through a NotificationAdapter so it can be faked in tests.
 */
import type { LocalDate, ScheduledReminder, Settings } from '../types';
import { addDays, atTime, formatHHMM, toLocalDate } from '../util';
import { isQuietMinute, ladderMinutes } from './ladder';
import { pickMessage } from './messages';

export const DAILY_URL = 'grasswork://session?kind=daily';
export const RESCUE_URL = 'grasswork://session?kind=rescue';
export const LAST_STEP = 4;

/** Small deterministic string hash (FNV-1a, 32-bit), used to seed message choice per date+step. */
export function seedFor(date: LocalDate, step: number): number {
  const s = `${date}#${step}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function reminderId(date: LocalDate, step: number): string {
  return `${date}#${step}`;
}

export function planReminders(input: {
  now: number;
  settings: Settings;
  doneDates: Set<LocalDate>;
  streak: number;
  minutesPlanned: number;
  days?: number;
  max?: number;
}): ScheduledReminder[] {
  const { now, settings, doneDates, streak, minutesPlanned } = input;
  const days = input.days ?? 12;
  const max = input.max ?? 60;
  const today = toLocalDate(now);
  const minutes = ladderMinutes(settings);
  const out: ScheduledReminder[] = [];

  for (let d = 0; d < days; d++) {
    const date = addDays(today, d);
    if (doneDates.has(date)) continue;
    for (let step = 0; step < minutes.length; step++) {
      if (!settings.ladderEnabled[step]) continue;
      const min = minutes[step];
      if (min >= 1440) continue; // past 23:59: belongs to no day
      if (isQuietMinute(min, settings)) continue;
      const fireAt = atTime(date, formatHHMM(min));
      if (fireAt <= now) continue;
      const msg = pickMessage(settings.tone, step, seedFor(date, step), { streak, minutes: minutesPlanned });
      out.push({
        id: reminderId(date, step),
        date,
        step,
        fireAt,
        title: msg.title,
        body: msg.body,
        url: step === LAST_STEP ? RESCUE_URL : DAILY_URL,
      });
    }
  }

  out.sort((a, b) => a.fireAt - b.fireAt || a.step - b.step);
  return out.slice(0, Math.max(0, max));
}

export interface NotificationAdapter {
  scheduledIds(): Promise<string[]>;
  schedule(r: ScheduledReminder): Promise<void>;
  cancel(id: string): Promise<void>;
}

/** Cancel ids no longer desired, schedule the missing ones, leave matching ones untouched. */
export async function syncNotifications(
  adapter: NotificationAdapter,
  desired: ScheduledReminder[],
): Promise<{ scheduled: number; cancelled: number }> {
  const existing = new Set(await adapter.scheduledIds());
  const wanted = new Map<string, ScheduledReminder>();
  for (const r of desired) wanted.set(r.id, r);

  let cancelled = 0;
  for (const id of existing) {
    if (!wanted.has(id)) {
      await adapter.cancel(id);
      cancelled++;
    }
  }
  let scheduled = 0;
  for (const r of wanted.values()) {
    if (!existing.has(r.id)) {
      await adapter.schedule(r);
      scheduled++;
    }
  }
  return { scheduled, cancelled };
}

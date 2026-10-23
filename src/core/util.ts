/** Small shared helpers. Pure, dependency-free. All dates use the device's local time zone. */
import type { LocalDate, Settings, StreakState } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** epoch ms -> 'YYYY-MM-DD' in local time */
export function toLocalDate(ms: number): LocalDate {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' -> epoch ms of local midnight */
export function localMidnight(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

/** date + n days (n may be negative), DST-safe */
export function addDays(date: LocalDate, n: number): LocalDate {
  const [y, m, d] = date.split('-').map(Number);
  return toLocalDate(new Date(y, m - 1, d + n, 12, 0, 0, 0).getTime());
}

/** whole days from a to b (b - a) */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** 0=Sunday..6=Saturday */
export function weekday(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getDay();
}

/** 'HH:MM' -> minutes after midnight */
export function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

/** minutes after midnight -> 'HH:MM' (wraps past 24h) */
export function formatHHMM(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** epoch ms for a local date at 'HH:MM' */
export function atTime(date: LocalDate, hhmm: string): number {
  return localMidnight(date) + parseHHMM(hhmm) * 60_000;
}

let counter = 0;
/** unique-enough id for local records */
export function newId(prefix = ''): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export const DEFAULT_SETTINGS: Settings = {
  anchorLabel: 'After coffee',
  sessionTime: '07:45',
  quietStart: '23:00',
  quietEnd: '07:00',
  tone: 'sassy',
  ladderEnabled: [true, true, true, true, true],
  testWeekday: 5, // Friday
  voiceCues: true,
  onboarded: false,
};

export const EMPTY_STREAK: StreakState = {
  current: 0,
  longest: 0,
  freezesBanked: 0,
  lastCountedDate: null,
  restDayUsed: null,
};

import { describe, it, expect } from 'bun:test';
import type { ScheduledReminder, Settings, Tone } from '../types';
import { DEFAULT_SETTINGS, addDays, atTime } from '../util';
import { isQuietMinute, ladderTimes } from './ladder';
import { MESSAGES, pickMessage } from './messages';
import { planReminders, syncNotifications, type NotificationAdapter } from './scheduler';

const S = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over });
const DAY = '2026-03-10';
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{FE0F}]/u;
const TONES: Tone[] = ['polite', 'sassy', 'unhinged'];

describe('ladderTimes', () => {
  it('07:45 session', () => {
    expect(ladderTimes(S({ sessionTime: '07:45' }))).toEqual(['07:45', '12:30', '18:00', '21:00', '22:30']);
  });
  it('09:00 session', () => {
    expect(ladderTimes(S({ sessionTime: '09:00' }))).toEqual(['09:00', '13:45', '19:15', '22:15', '23:45']);
  });
  it('always 5 entries, wrapping past midnight', () => {
    const t = ladderTimes(S({ sessionTime: '12:00' }));
    expect(t).toEqual(['12:00', '16:45', '22:15', '01:15', '02:45']);
    expect(ladderTimes(S({ sessionTime: '23:30' })).length).toBe(5);
  });
});

describe('quiet hours', () => {
  it('normal range', () => {
    const q = { quietStart: '13:00', quietEnd: '14:00' };
    expect(isQuietMinute(13 * 60, q)).toBe(true);
    expect(isQuietMinute(13 * 60 + 59, q)).toBe(true);
    expect(isQuietMinute(14 * 60, q)).toBe(false);
    expect(isQuietMinute(12 * 60 + 59, q)).toBe(false);
  });
  it('spanning midnight', () => {
    const q = { quietStart: '23:00', quietEnd: '07:00' };
    expect(isQuietMinute(23 * 60, q)).toBe(true);
    expect(isQuietMinute(30, q)).toBe(true);
    expect(isQuietMinute(6 * 60 + 59, q)).toBe(true);
    expect(isQuietMinute(7 * 60, q)).toBe(false);
    expect(isQuietMinute(22 * 60 + 59, q)).toBe(false);
  });
  it('equal start/end means no quiet hours', () => {
    expect(isQuietMinute(0, { quietStart: '00:00', quietEnd: '00:00' })).toBe(false);
  });
  it('planReminders drops steps inside quiet hours', () => {
    // 09:00 -> last step 23:45 is in 23:00–07:00 quiet
    const r = planReminders({ now: atTime(DAY, '00:00'), settings: S({ sessionTime: '09:00' }), doneDates: new Set(), streak: 3, minutesPlanned: 8, days: 1 });
    expect(r.map((x) => x.step)).toEqual([0, 1, 2, 3]);
    // session at 06:30 inside quiet -> step 0 dropped
    const r2 = planReminders({ now: atTime(DAY, '00:00'), settings: S({ sessionTime: '06:30' }), doneDates: new Set(), streak: 3, minutesPlanned: 8, days: 1 });
    expect(r2.map((x) => x.step)).toEqual([1, 2, 3, 4]);
  });
  it('planReminders drops steps past 23:59 (no wrap into next day)', () => {
    const r = planReminders({ now: atTime(DAY, '00:00'), settings: S({ sessionTime: '12:00', quietStart: '00:00', quietEnd: '00:00' }), doneDates: new Set(), streak: 0, minutesPlanned: 8, days: 1 });
    expect(r.map((x) => x.step)).toEqual([0, 1, 2]);
    expect(r.every((x) => x.date === DAY)).toBe(true);
  });
});

describe('planReminders', () => {
  const base = { settings: S(), streak: 5, minutesPlanned: 9 };

  it('one full ladder per day with correct times and ids', () => {
    const r = planReminders({ ...base, now: atTime(DAY, '06:00'), doneDates: new Set(), days: 1 });
    expect(r.map((x) => x.id)).toEqual([0, 1, 2, 3, 4].map((s) => `${DAY}#${s}`));
    expect(r.map((x) => x.fireAt)).toEqual(['07:45', '12:30', '18:00', '21:00', '22:30'].map((t) => atTime(DAY, t)));
  });

  it('skips done dates', () => {
    const r = planReminders({ ...base, now: atTime(DAY, '06:00'), doneDates: new Set([DAY]), days: 3 });
    expect(r.some((x) => x.date === DAY)).toBe(false);
    expect(r.length).toBe(10);
  });

  it('skips past times (and fireAt == now)', () => {
    const r = planReminders({ ...base, now: atTime(DAY, '12:30'), doneDates: new Set(), days: 1 });
    expect(r.map((x) => x.step)).toEqual([2, 3, 4]);
  });

  it('skips disabled steps', () => {
    const settings = S({ ladderEnabled: [true, false, true, false, true] });
    const r = planReminders({ ...base, settings, now: atTime(DAY, '06:00'), doneDates: new Set(), days: 2 });
    expect(new Set(r.map((x) => x.step))).toEqual(new Set([0, 2, 4]));
    expect(r.length).toBe(6);
  });

  it('12-day horizon by default', () => {
    const r = planReminders({ ...base, now: atTime(DAY, '06:00'), doneDates: new Set(), max: 1000 });
    expect(r.length).toBe(60);
    expect(r[0].date).toBe(DAY);
    expect(r[r.length - 1].date).toBe(addDays(DAY, 11));
  });

  it('caps at max (default 60), keeping the earliest', () => {
    const r = planReminders({ ...base, now: atTime(DAY, '13:00'), doneDates: new Set(), days: 20 });
    expect(r.length).toBe(60);
    const r2 = planReminders({ ...base, now: atTime(DAY, '06:00'), doneDates: new Set(), max: 7 });
    expect(r2.length).toBe(7);
    expect(r2.map((x) => x.id)).toEqual([...[0, 1, 2, 3, 4].map((s) => `${DAY}#${s}`), `${addDays(DAY, 1)}#0`, `${addDays(DAY, 1)}#1`]);
  });

  it('sorted by fireAt', () => {
    const r = planReminders({ ...base, now: atTime(DAY, '06:00'), doneDates: new Set() });
    for (let i = 1; i < r.length; i++) expect(r[i].fireAt).toBeGreaterThan(r[i - 1].fireAt);
  });

  it('ids and messages are stable across calls and nows', () => {
    const a = planReminders({ ...base, now: atTime(DAY, '06:00'), doneDates: new Set() });
    const b = planReminders({ ...base, now: atTime(DAY, '07:00'), doneDates: new Set() });
    expect(a).toEqual(b);
    // later call shares ids with earlier for overlapping entries
    const c = planReminders({ ...base, now: atTime(DAY, '19:00'), doneDates: new Set() });
    const byId = new Map(a.map((x) => [x.id, x]));
    for (const x of c) if (byId.has(x.id)) expect(x).toEqual(byId.get(x.id)!);
  });

  it('message choice varies across dates (seeded by date+step)', () => {
    const r = planReminders({ ...base, now: atTime(DAY, '06:00'), doneDates: new Set() });
    const step0 = new Set(r.filter((x) => x.step === 0).map((x) => x.body));
    expect(step0.size).toBeGreaterThan(1);
  });

  it('step 4 links to rescue and mentions 3-minute rescue; others link to daily', () => {
    for (const tone of TONES) {
      const r = planReminders({ ...base, settings: S({ tone }), now: atTime(DAY, '06:00'), doneDates: new Set() });
      for (const x of r) {
        if (x.step === 4) {
          expect(x.url).toBe('grasswork://session?kind=rescue');
          expect(x.body).toMatch(/3-minute rescue/i);
        } else {
          expect(x.url).toBe('grasswork://session?kind=daily');
        }
      }
    }
  });

  it('fills placeholders', () => {
    const r = planReminders({ ...base, now: atTime(DAY, '06:00'), doneDates: new Set() });
    for (const x of r) {
      expect(x.body).not.toMatch(/[{}]/);
      expect(x.title).toMatch(/^(Gus|Grasswork)$/);
    }
  });
});

describe('messages', () => {
  it('>= 3 variants for every tone x step, 5 steps', () => {
    for (const tone of TONES) {
      expect(MESSAGES[tone].length).toBe(5);
      for (const variants of MESSAGES[tone]) expect(variants.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('no emoji anywhere, titles plain', () => {
    for (const tone of TONES)
      for (let step = 0; step < 5; step++)
        for (let seed = 0; seed < 6; seed++) {
          const m = pickMessage(tone, step, seed, { streak: 4, minutes: 7 });
          expect(EMOJI.test(m.title)).toBe(false);
          expect(EMOJI.test(m.body)).toBe(false);
          expect(['Gus', 'Grasswork']).toContain(m.title);
        }
    for (const tone of TONES) for (const v of MESSAGES[tone].flat()) expect(EMOJI.test(v)).toBe(false);
  });

  it('only known placeholders, all filled', () => {
    for (const tone of TONES) for (const v of MESSAGES[tone].flat()) expect(v.replace(/\{(streak|minutes)\}/g, '')).not.toMatch(/[{}]/);
    for (const tone of TONES)
      for (let step = 0; step < 5; step++)
        for (let seed = 0; seed < 3; seed++) {
          const m = pickMessage(tone, step, seed, { streak: 12, minutes: 9 });
          expect(m.body).not.toMatch(/[{}]/);
        }
    const withStreak = MESSAGES.polite[2].findIndex((v) => v.includes('{streak}'));
    expect(pickMessage('polite', 2, withStreak, { streak: 12, minutes: 9 }).body).toContain('12');
  });

  it('every step-4 variant offers the 3-minute rescue', () => {
    for (const tone of TONES) for (const v of MESSAGES[tone][4]) expect(v).toMatch(/3-minute rescue/i);
  });

  it('each seed in range picks every variant', () => {
    for (const tone of TONES)
      for (let step = 0; step < 5; step++) {
        const n = MESSAGES[tone][step].length;
        const seen = new Set<string>();
        for (let seed = 0; seed < n; seed++) seen.add(pickMessage(tone, step, seed, { streak: 3, minutes: 5 }).body);
        expect(seen.size).toBe(n);
      }
  });

  it('streak 0 never mentions the streak', () => {
    for (const tone of TONES)
      for (let step = 0; step < 5; step++)
        for (let seed = 0; seed < 10; seed++) {
          const m = pickMessage(tone, step, seed, { streak: 0, minutes: 6 });
          expect(m.body).not.toMatch(/\bstreak\b.*\b0\b|\b0\b.*\bstreak\b|0-day/i);
          if (step !== 2) expect(m.body.toLowerCase()).not.toContain('streak alive');
        }
    // step 2 is all streak warnings, so streak 0 falls back to "start a streak" copy
    const m = pickMessage('polite', 2, 0, { streak: 0, minutes: 6 });
    expect(m.body).not.toMatch(/\{|0-day/);
  });

  it('deterministic and handles odd seeds', () => {
    expect(pickMessage('sassy', 1, 42, { streak: 2, minutes: 5 })).toEqual(pickMessage('sassy', 1, 42, { streak: 2, minutes: 5 }));
    expect(pickMessage('sassy', 1, -7, { streak: 2, minutes: 5 }).body.length).toBeGreaterThan(0);
    expect(pickMessage('sassy', 1, 2 ** 32 - 1, { streak: 2, minutes: 5 }).body.length).toBeGreaterThan(0);
  });
});

function fakeAdapter(initial: string[]) {
  const ids = new Set(initial);
  const log = { scheduled: [] as string[], cancelled: [] as string[] };
  const adapter: NotificationAdapter = {
    async scheduledIds() {
      return [...ids];
    },
    async schedule(r: ScheduledReminder) {
      ids.add(r.id);
      log.scheduled.push(r.id);
    },
    async cancel(id: string) {
      ids.delete(id);
      log.cancelled.push(id);
    },
  };
  return { adapter, ids, log };
}

describe('syncNotifications', () => {
  it('cancels stale, adds missing, keeps matching', async () => {
    const desired = planReminders({ now: atTime(DAY, '06:00'), settings: S(), doneDates: new Set(), streak: 1, minutesPlanned: 8, days: 2 });
    const keep = desired.slice(0, 3).map((r) => r.id);
    const { adapter, ids, log } = fakeAdapter([...keep, 'stale#1', `${addDays(DAY, -1)}#4`]);
    const res = await syncNotifications(adapter, desired);
    expect(res).toEqual({ scheduled: desired.length - 3, cancelled: 2 });
    expect(log.cancelled.sort()).toEqual([`${addDays(DAY, -1)}#4`, 'stale#1'].sort());
    for (const k of keep) expect(log.scheduled).not.toContain(k);
    expect([...ids].sort()).toEqual(desired.map((r) => r.id).sort());
  });

  it('is idempotent', async () => {
    const desired = planReminders({ now: atTime(DAY, '06:00'), settings: S(), doneDates: new Set(), streak: 1, minutesPlanned: 8 });
    const { adapter } = fakeAdapter([]);
    expect(await syncNotifications(adapter, desired)).toEqual({ scheduled: desired.length, cancelled: 0 });
    expect(await syncNotifications(adapter, desired)).toEqual({ scheduled: 0, cancelled: 0 });
  });

  it('marking today done cancels the rest of today', async () => {
    const before = planReminders({ now: atTime(DAY, '13:00'), settings: S(), doneDates: new Set(), streak: 1, minutesPlanned: 8 });
    const { adapter, log } = fakeAdapter(before.map((r) => r.id));
    const after = planReminders({ now: atTime(DAY, '13:05'), settings: S(), doneDates: new Set([DAY]), streak: 2, minutesPlanned: 8 });
    const res = await syncNotifications(adapter, after);
    expect(log.cancelled.sort()).toEqual([`${DAY}#2`, `${DAY}#3`, `${DAY}#4`]);
    // horizon still counts from today, so no new days are added
    expect(res).toEqual({ scheduled: 0, cancelled: 3 });
  });

  it('empty desired cancels everything', async () => {
    const { adapter, ids } = fakeAdapter(['a', 'b']);
    expect(await syncNotifications(adapter, [])).toEqual({ scheduled: 0, cancelled: 2 });
    expect(ids.size).toBe(0);
  });
});

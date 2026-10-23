import { describe, it, expect } from 'bun:test';
import { canUseRestDay, dayStatuses, minutesLeftToday, rollStreak } from './streak';
import { EMPTY_STREAK, addDays, atTime, localMidnight } from '../util';
import type { StreakState } from '../types';

const T = '2026-10-23'; // Friday
const set = (...offs: number[]) => new Set(offs.map((o) => addDays(T, o)));
const st = (p: Partial<StreakState>): StreakState => ({ ...EMPTY_STREAK, ...p });

describe('rollStreak', () => {
  it('starts from null and counts done days up to today', () => {
    const r = rollStreak(EMPTY_STREAK, { today: T, doneDates: set(-2, -1, 0), restDates: new Set() });
    expect(r.state).toMatchObject({ current: 3, longest: 3, lastCountedDate: T });
    expect(r.frozenDates).toEqual([]);
  });
  it('null state with no activity stays empty', () => {
    expect(rollStreak(EMPTY_STREAK, { today: T, doneDates: new Set(), restDates: new Set() }).state).toEqual(EMPTY_STREAK);
  });
  it('does not count today until done', () => {
    const r = rollStreak(EMPTY_STREAK, { today: T, doneDates: set(-2, -1), restDates: new Set() });
    expect(r.state).toMatchObject({ current: 2, lastCountedDate: addDays(T, -1) });
  });
  it('rest counts as a day', () => {
    const r = rollStreak(EMPTY_STREAK, { today: T, doneDates: set(-3, -1), restDates: set(-2) });
    expect(r.state.current).toBe(3);
  });
  it('a missed day without freezes resets', () => {
    const s = st({ current: 5, longest: 5, lastCountedDate: addDays(T, -3) });
    const r = rollStreak(s, { today: T, doneDates: set(-1, 0), restDates: new Set() });
    expect(r.state).toMatchObject({ current: 2, longest: 5, lastCountedDate: T });
    expect(r.frozenDates).toEqual([]);
  });
  it('a missed day with a freeze keeps the streak', () => {
    const s = st({ current: 5, longest: 5, freezesBanked: 1, lastCountedDate: addDays(T, -3) });
    const r = rollStreak(s, { today: T, doneDates: set(-1), restDates: new Set() });
    expect(r.frozenDates).toEqual([addDays(T, -2)]);
    expect(r.state).toMatchObject({ current: 6, freezesBanked: 0, lastCountedDate: addDays(T, -1) });
  });
  it('freezes run out, then the streak resets', () => {
    const s = st({ current: 10, longest: 10, freezesBanked: 2, lastCountedDate: addDays(T, -5) });
    const r = rollStreak(s, { today: T, doneDates: new Set(), restDates: new Set() });
    expect(r.frozenDates).toEqual([addDays(T, -4), addDays(T, -3)]);
    expect(r.state).toMatchObject({ current: 0, longest: 10, freezesBanked: 0 });
  });
  it('earns a freeze every 7 days, capped at 2', () => {
    const days = Array.from({ length: 21 }, (_, i) => i - 20);
    const r = rollStreak(EMPTY_STREAK, { today: T, doneDates: set(...days), restDates: new Set() });
    expect(r.state).toMatchObject({ current: 21, longest: 21, freezesBanked: 2 });
    const r7 = rollStreak(EMPTY_STREAK, { today: T, doneDates: set(-6, -5, -4, -3, -2, -1, 0), restDates: new Set() });
    expect(r7.state.freezesBanked).toBe(1);
    const r6 = rollStreak(EMPTY_STREAK, { today: T, doneDates: set(-5, -4, -3, -2, -1, 0), restDates: new Set() });
    expect(r6.state.freezesBanked).toBe(0);
  });
  it('is idempotent', () => {
    const input = { today: T, doneDates: set(-9, -8, -6, -5, -4, -1, 0), restDates: set(-2) };
    const a = rollStreak(st({ freezesBanked: 1 }), input);
    const b = rollStreak(a.state, input);
    expect(b.state).toEqual(a.state);
    expect(b.frozenDates).toEqual([]);
    // idempotent mid-day before done and after a reset
    const s = st({ current: 4, longest: 4, lastCountedDate: addDays(T, -4) });
    const in2 = { today: T, doneDates: set(-5, -4), restDates: new Set<string>() };
    const c = rollStreak(s, in2);
    expect(rollStreak(c.state, in2).state).toEqual(c.state);
    expect(c.state.current).toBe(0);
  });
  it('rolls forward across a later day', () => {
    const a = rollStreak(EMPTY_STREAK, { today: T, doneDates: set(-1, 0), restDates: new Set() });
    const b = rollStreak(a.state, { today: addDays(T, 1), doneDates: set(-1, 0, 1), restDates: new Set() });
    expect(b.state).toMatchObject({ current: 3, lastCountedDate: addDays(T, 1) });
  });
});

describe('dayStatuses', () => {
  it('labels each day from `from` to today', () => {
    const m = dayStatuses({ today: T, from: addDays(T, -4), doneDates: set(-4, 0), frozenDates: set(-3), restDates: set(-2) });
    expect([...m.entries()]).toEqual([
      [addDays(T, -4), 'done'],
      [addDays(T, -3), 'frozen'],
      [addDays(T, -2), 'rest'],
      [addDays(T, -1), 'missed'],
      [T, 'done'],
    ]);
  });
  it('omits today while pending', () => {
    const m = dayStatuses({ today: T, from: addDays(T, -1), doneDates: new Set(), frozenDates: new Set(), restDates: new Set() });
    expect(m.has(T)).toBe(false);
    expect(m.get(addDays(T, -1))).toBe('missed');
  });
});

describe('canUseRestDay', () => {
  it('one per Monday–Sunday week', () => {
    expect(canUseRestDay(EMPTY_STREAK, T)).toBe(true);
    expect(canUseRestDay(st({ restDayUsed: '2026-10-19' }), T)).toBe(false); // Monday same week
    expect(canUseRestDay(st({ restDayUsed: '2026-10-18' }), T)).toBe(true); // previous Sunday
    expect(canUseRestDay(st({ restDayUsed: '2026-10-19' }), '2026-10-25')).toBe(false); // Sunday same week
    expect(canUseRestDay(st({ restDayUsed: '2026-10-25' }), '2026-10-26')).toBe(true); // next Monday
  });
});

describe('minutesLeftToday', () => {
  it('counts down to local midnight', () => {
    expect(minutesLeftToday(atTime(T, '23:00'))).toBe(60);
    expect(minutesLeftToday(atTime(T, '21:30'))).toBe(150);
    expect(minutesLeftToday(localMidnight(T))).toBe(1440);
    expect(minutesLeftToday(atTime(T, '23:59') + 30_000)).toBe(1);
  });
});

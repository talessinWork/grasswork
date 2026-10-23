import { describe, it, expect } from 'bun:test';
import { GUS_LINES, gusLine, gusMood } from './gus';
import { DEFAULT_SETTINGS, EMPTY_STREAK, addDays, atTime } from '../util';
import type { GusMood, Tone } from '../types';

const T = '2026-10-23';
const streak = { ...EMPTY_STREAK, current: 4, longest: 4, lastCountedDate: addDays(T, -1) };
const mood = (hhmm: string, p: Partial<Parameters<typeof gusMood>[0]> = {}) =>
  gusMood({ now: atTime(T, hhmm), doneToday: false, settings: DEFAULT_SETTINGS, streak, ...p });

describe('gusMood', () => {
  it('thriving once done, at any time', () => {
    expect(mood('06:00', { doneToday: true })).toBe('thriving');
    expect(mood('22:00', { doneToday: true })).toBe('thriving');
  });
  it('waiting before the session time and until 18:00', () => {
    expect(mood('07:00')).toBe('waiting');
    expect(mood('12:00')).toBe('waiting');
    expect(mood('17:59')).toBe('waiting');
  });
  it('wilting from 18:00 when not done', () => {
    expect(mood('18:00')).toBe('wilting');
    expect(mood('23:30')).toBe('wilting');
  });
  it('dormant when streak is 0 and last activity 3+ days ago', () => {
    const lapsed = { ...EMPTY_STREAK, lastCountedDate: addDays(T, -3) };
    expect(mood('09:00', { streak: lapsed })).toBe('dormant');
    expect(mood('19:00', { streak: lapsed })).toBe('dormant');
    expect(mood('09:00', { streak: { ...lapsed, lastCountedDate: addDays(T, -2) } })).toBe('waiting');
    expect(mood('09:00', { streak: { ...lapsed, current: 1 } })).toBe('waiting');
    expect(mood('09:00', { streak: lapsed, doneToday: true })).toBe('thriving');
  });
  it('brand-new user is waiting, not dormant', () => {
    expect(mood('09:00', { streak: EMPTY_STREAK })).toBe('waiting');
  });
});

describe('gusLine', () => {
  const moods: GusMood[] = ['thriving', 'waiting', 'wilting', 'dormant'];
  const tones: Tone[] = ['polite', 'sassy', 'unhinged'];
  it('has >= 4 lines per mood per tone', () => {
    for (const m of moods) for (const t of tones) expect(GUS_LINES[m][t].length).toBeGreaterThanOrEqual(4);
  });
  it('is deterministic by seed and fills placeholders', () => {
    for (const m of moods)
      for (const t of tones)
        for (let seed = -3; seed < 10; seed++) {
          const a = gusLine(m, t, seed, { streak: 12, minutesPlanned: 7 });
          expect(a).toBe(gusLine(m, t, seed, { streak: 12, minutesPlanned: 7 }));
          expect(a).not.toMatch(/[{}]/);
          expect(a.length).toBeGreaterThan(0);
        }
    expect(gusLine('thriving', 'polite', 1, { streak: 12, minutesPlanned: 7 })).toBe('Day 12 done. Thank you for showing up.');
  });
  it('different seeds give different lines', () => {
    const lines = new Set([0, 1, 2, 3].map((s) => gusLine('waiting', 'sassy', s, { streak: 1, minutesPlanned: 5 })));
    expect(lines.size).toBe(4);
  });
});

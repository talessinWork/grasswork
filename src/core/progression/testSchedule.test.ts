import { describe, it, expect } from 'bun:test';
import { isTestDay, weekNumber } from './testSchedule';
import { DEFAULT_SETTINGS } from '../util';
import type { SessionRecord } from '../types';

const FRI = '2026-10-23'; // a Friday; DEFAULT_SETTINGS.testWeekday = 5
const s = (date: string, kind: SessionRecord['kind'], completed = true): SessionRecord => ({
  id: `${date}-${kind}`, date, kind, startedAt: 0, endedAt: null, completed,
});

describe('isTestDay', () => {
  it('matches the weekday', () => {
    expect(isTestDay(FRI, DEFAULT_SETTINGS, [])).toBe(true);
    expect(isTestDay('2026-10-22', DEFAULT_SETTINGS, [])).toBe(false);
    expect(isTestDay('2026-10-25', { ...DEFAULT_SETTINGS, testWeekday: 0 }, [])).toBe(true);
  });
  it('is false once a test session was done that day', () => {
    expect(isTestDay(FRI, DEFAULT_SETTINGS, [s(FRI, 'test')])).toBe(false);
    expect(isTestDay(FRI, DEFAULT_SETTINGS, [s(FRI, 'daily')])).toBe(true);
    expect(isTestDay(FRI, DEFAULT_SETTINGS, [s('2026-10-16', 'test')])).toBe(true);
    expect(isTestDay(FRI, DEFAULT_SETTINGS, [s(FRI, 'test', false)])).toBe(true);
  });
});

describe('weekNumber', () => {
  it('is 1-based from the first session', () => {
    expect(weekNumber(null, FRI)).toBe(1);
    expect(weekNumber(FRI, FRI)).toBe(1);
    expect(weekNumber('2026-10-17', FRI)).toBe(1);
    expect(weekNumber('2026-10-16', FRI)).toBe(2);
    expect(weekNumber('2026-10-02', FRI)).toBe(4);
    expect(weekNumber('2026-11-01', FRI)).toBe(1);
  });
});

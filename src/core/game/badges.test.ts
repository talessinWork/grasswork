import { describe, it, expect } from 'bun:test';
import { BADGES, newBadges } from './badges';
import { EMPTY_STREAK } from '../util';

const base = { earned: {}, streak: EMPTY_STREAK, totalHolds: 0, ranksReached: [] as string[], testsTaken: 0, weekAllDone: false };

describe('badges', () => {
  it('lists the 8 contract ids', () => {
    expect(BADGES.map((b) => b.id)).toEqual(['first_grass', 'first_floor', 'streak_7', 'streak_30', 'streak_100', 'holds_100', 'perfect_week', 'first_test']);
  });
  it('awards nothing on an empty context', () => {
    expect(newBadges(base)).toEqual([]);
  });
  it('awards each rule', () => {
    expect(newBadges({ ...base, ranksReached: ['Grass'] })).toEqual(['first_grass']);
    expect(newBadges({ ...base, ranksReached: ['Floor'] })).toEqual(['first_floor']);
    expect(newBadges({ ...base, streak: { ...EMPTY_STREAK, current: 7, longest: 7 } })).toEqual(['streak_7']);
    expect(newBadges({ ...base, streak: { ...EMPTY_STREAK, current: 100, longest: 100 } })).toEqual(['streak_7', 'streak_30', 'streak_100']);
    expect(newBadges({ ...base, totalHolds: 99 })).toEqual([]);
    expect(newBadges({ ...base, totalHolds: 100 })).toEqual(['holds_100']);
    expect(newBadges({ ...base, weekAllDone: true })).toEqual(['perfect_week']);
    expect(newBadges({ ...base, testsTaken: 1 })).toEqual(['first_test']);
  });
  it('skips already earned badges', () => {
    expect(newBadges({ ...base, testsTaken: 3, totalHolds: 200, earned: { first_test: 1 } })).toEqual(['holds_100']);
  });
});

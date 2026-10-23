/** Badge catalogue and award rules. Pure. */
import type { StreakState } from '../types';

export interface BadgeMeta {
  id: string;
  name: string;
  description: string;
}

export const BADGES: BadgeMeta[] = [
  { id: 'first_grass', name: 'Touch Grass', description: 'Reach the Grass rank: a full deep squat.' },
  { id: 'first_floor', name: 'Floor It', description: 'Reach the Floor rank: fingertips on the floor.' },
  { id: 'streak_7', name: 'One Week Wonder', description: 'Keep a 7-day streak.' },
  { id: 'streak_30', name: 'Monthly Mover', description: 'Keep a 30-day streak.' },
  { id: 'streak_100', name: 'Centurion', description: 'Keep a 100-day streak.' },
  { id: 'holds_100', name: 'Hold Collector', description: 'Complete 100 verified holds.' },
  { id: 'perfect_week', name: 'Perfect Week', description: 'Do every session in a Monday–Sunday week.' },
  { id: 'first_test', name: 'Boss Fight', description: 'Take your first weekly test.' },
];

/** Badge ids newly earned (not in ctx.earned), in BADGES order. */
export function newBadges(ctx: {
  earned: Record<string, number>;
  streak: StreakState;
  totalHolds: number;
  ranksReached: string[];
  testsTaken: number;
  weekAllDone: boolean;
}): string[] {
  const best = Math.max(ctx.streak.current, ctx.streak.longest);
  const ok: Record<string, boolean> = {
    first_grass: ctx.ranksReached.includes('Grass'),
    first_floor: ctx.ranksReached.includes('Floor') || ctx.ranksReached.includes('Palms'),
    streak_7: best >= 7,
    streak_30: best >= 30,
    streak_100: best >= 100,
    holds_100: ctx.totalHolds >= 100,
    perfect_week: ctx.weekAllDone,
    first_test: ctx.testsTaken >= 1,
  };
  return BADGES.filter((b) => ok[b.id] && !(b.id in ctx.earned)).map((b) => b.id);
}

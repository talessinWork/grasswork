/** Display copy and presets from the artboards (no business rules). */
import type { GoalId, Tone } from '../core/types';
import type { SilhouetteKind } from './session/display';

/** Goal card titles in onboarding (the end pose, not the ladder name). */
export const GOAL_CARD: Record<GoalId, { title: string; silhouette: SilhouetteKind }> = {
  deep_squat: { title: 'Ass-to-grass squat', silhouette: 'squat' },
  forward_fold: { title: 'Palms to the floor', silhouette: 'fold' },
  front_split: { title: 'Front split', silhouette: 'split' },
  bridge: { title: 'Full bridge', silhouette: 'bridge' },
  overhead_reach: { title: 'Overhead reach', silhouette: 'overhead' },
  straddle: { title: 'Seated straddle', silhouette: 'straddle' },
};

/** Short goal word used on Home rank tiles: "Squat rank", "Fold rank". */
export const GOAL_SHORT: Record<GoalId, string> = {
  deep_squat: 'Squat',
  forward_fold: 'Fold',
  front_split: 'Split',
  bridge: 'Bridge',
  overhead_reach: 'Reach',
  straddle: 'Straddle',
};

/** Habit anchors and the time each one suggests. */
export const ANCHORS: { label: string; time: string }[] = [
  { label: 'After coffee', time: '07:45' },
  { label: 'After shower', time: '07:15' },
  { label: 'After work', time: '18:00' },
  { label: 'Before bed', time: '21:30' },
];

export const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: 'polite', label: 'Polite' },
  { value: 'sassy', label: 'Sassy' },
  { value: 'unhinged', label: 'Unhinged' },
];

/** Nag ladder step names (Attitude artboard), index = ladder step. */
export const LADDER_NAMES = ['first call', 'gentle poke', 'streak warning', 'Gus wilts', 'last call + rescue'];

/** Rank-up taglines; fallback is generic. */
export const RANK_TAGLINE: Record<string, string> = {
  Grass: 'Ass to grass. Officially.',
  Palms: 'Palms flat. Hamstrings humbled.',
  Floor: 'Fingertips meet floor. Hello, floor.',
  Curb: 'Lower than a curb. Getting serious.',
  Bench: 'Bench height, beaten.',
  Ankles: 'Down to the ankles.',
  Shins: 'Past the knees, onto the shins.',
};

export const DEFAULT_QUIET = { start: '23:00', end: '07:00' };

/** Stretch specs (JSON data) + goal metadata + depth display helper. */
import type { GoalId, JointName, MetricId, StretchSpec } from '../../types';
import { isMetricId } from '../metrics';

import squatChair from './squat_chair.json';
import squatHeelsRaised from './squat_heels_raised.json';
import squatCurb from './squat_curb.json';
import deepSquat from './deep_squat.json';
import foldKnees from './fold_knees.json';
import foldShins from './fold_shins.json';
import foldAnkles from './fold_ankles.json';
import foldFloor from './fold_floor.json';
import foldPalms from './fold_palms.json';
import couchStretch from './couch_stretch.json';
import squatSit from './squat_sit.json';

const JOINTS: ReadonlySet<string> = new Set<JointName>([
  'shoulder',
  'elbow',
  'wrist',
  'index',
  'hip',
  'knee',
  'ankle',
  'heel',
  'foot_index',
]);
const OPS: ReadonlySet<string> = new Set(['<', '<=', '>', '>=']);

/** Throws when a spec references an unknown metric, joint or operator. */
export function validateSpec(spec: StretchSpec): StretchSpec {
  const where = `spec "${spec.id}"`;
  if (!isMetricId(spec.depthMetric)) throw new Error(`${where}: unknown depthMetric "${spec.depthMetric}"`);
  for (const r of spec.rules) {
    if (!isMetricId(r.metric)) throw new Error(`${where}: rule "${r.id}" has unknown metric "${r.metric}"`);
    if (!OPS.has(r.op)) throw new Error(`${where}: rule "${r.id}" has unknown op "${r.op}"`);
  }
  for (const j of spec.required) if (!JOINTS.has(j)) throw new Error(`${where}: unknown joint "${j}"`);
  if (spec.view !== 'side' && spec.view !== 'front') throw new Error(`${where}: bad view "${spec.view}"`);
  if (spec.depthBetter !== 'higher' && spec.depthBetter !== 'lower') throw new Error(`${where}: bad depthBetter`);
  return spec;
}

export const SPECS: StretchSpec[] = [
  squatChair,
  squatHeelsRaised,
  squatCurb,
  deepSquat,
  foldKnees,
  foldShins,
  foldAnkles,
  foldFloor,
  foldPalms,
  couchStretch,
  squatSit,
].map((s) => validateSpec(s as unknown as StretchSpec));

const BY_ID = new Map(SPECS.map((s) => [s.id, s]));

export function getSpec(id: string): StretchSpec {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`Unknown stretch id "${id}"`);
  return s;
}

export function specsForGoal(goalId: GoalId): StretchSpec[] {
  return SPECS.filter((s) => s.goalId === goalId).sort((a, b) => a.level - b.level);
}

export interface GoalMeta {
  id: GoalId;
  name: string;
  ranks: string[];
  available: boolean;
  bossName: string;
  unit: string;
  referenceLabel: string;
}

export const GOALS: GoalMeta[] = [
  {
    id: 'deep_squat',
    name: 'Deep squat',
    ranks: ['Chair', 'Bench', 'Curb', 'Grass'],
    available: true,
    bossName: 'The Bench',
    unit: 'cm below knee',
    referenceLabel: 'knee height',
  },
  {
    id: 'forward_fold',
    name: 'Forward fold',
    ranks: ['Knees', 'Shins', 'Ankles', 'Floor', 'Palms'],
    available: true,
    bossName: 'The Floor',
    unit: 'cm to floor',
    referenceLabel: 'floor',
  },
  { id: 'front_split', name: 'Front split', ranks: [], available: false, bossName: 'The Gap', unit: 'cm to floor', referenceLabel: 'floor' },
  { id: 'bridge', name: 'Bridge', ranks: [], available: false, bossName: 'The Arch', unit: 'cm hip height', referenceLabel: 'floor' },
  { id: 'overhead_reach', name: 'Overhead reach', ranks: [], available: false, bossName: 'The Ceiling', unit: '°', referenceLabel: 'vertical' },
  { id: 'straddle', name: 'Straddle', ranks: [], available: false, bossName: 'The Wishbone', unit: '°', referenceLabel: 'legs apart' },
];

export function getGoal(id: GoalId): GoalMeta {
  const g = GOALS.find((x) => x.id === id);
  if (!g) throw new Error(`Unknown goal id "${id}"`);
  return g;
}

/** Assumed body proportions for turning normalized depths into approximate centimetres. */
export const SHIN_CM = 40;
export const THIGH_CM = 45;
export const TORSO_CM = 50;

const ANGLE_METRICS: ReadonlySet<MetricId> = new Set<MetricId>([
  'kneeAngle',
  'hipAngle',
  'torsoLean',
  'backThighVertical',
  'straddleAngle',
  'shoulderFlexion',
]);

/** Depth metric value -> short human text, e.g. "3 cm below knee", "12 cm to floor", "4 cm past floor". */
export function formatDepth(spec: StretchSpec, depth: number): string {
  if (!Number.isFinite(depth)) return '–';
  const m = spec.depthMetric;
  if (ANGLE_METRICS.has(m)) return `${Math.round(depth)}°`;
  switch (m) {
    case 'hipBelowKnee': {
      const cm = Math.round(depth * THIGH_CM);
      if (cm === 0) return 'at knee height';
      return cm > 0 ? `${cm} cm below knee` : `${-cm} cm above knee`;
    }
    case 'fingertipToFloor': {
      const cm = Math.round(depth * SHIN_CM);
      if (cm === 0) return 'touching the floor';
      return cm > 0 ? `${cm} cm to floor` : `${-cm} cm past floor`;
    }
    case 'heelLift':
      return `${Math.max(0, Math.round(depth * SHIN_CM))} cm heel lift`;
    case 'hipHeight':
      return `${Math.round(depth * TORSO_CM)} cm hip height`;
    default:
      return String(Math.round(depth * 100) / 100);
  }
}

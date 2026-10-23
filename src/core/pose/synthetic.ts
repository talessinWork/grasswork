/**
 * Synthetic stick-figure poses for tests (and debug tooling). Coordinates are given in
 * image-height units (aspect-corrected); x is scaled by 1/`aspect` about the image centre when written into the pose.
 */
import type { JointName, Landmark, Pose, PoseFrame, Side } from '../types';
import { POSE_LANDMARK_COUNT } from '../types';
import { jointIndex, otherSide } from './landmarks';

export type Pt = [number, number];
export type Joints = Partial<Record<JointName, Pt>> & { nose?: Pt };

export interface StickOpts {
  /** which side faces the camera (side view) */
  side?: Side;
  aspect?: number;
  /** visibility of the camera-facing side */
  nearVis?: number;
  /** visibility of the far side */
  farVis?: number;
  /** horizontal offset of the far side in height units (small = side-on) */
  farDx?: number;
  /** per-joint visibility override on the near side */
  vis?: Partial<Record<JointName, number>>;
}

/** height units -> normalized x, scaled about the image centre so figures stay in frame */
const toX = (x: number, aspect: number) => 0.5 + (x - 0.5) / aspect;

const blank = (): Landmark => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 });

/** Side-view stick figure: far side mirrors the near side with a small x offset. */
export function stickPose(j: Joints, opts: StickOpts = {}): Pose {
  const side = opts.side ?? 'left';
  const aspect = opts.aspect ?? 1;
  const nearVis = opts.nearVis ?? 0.95;
  const farVis = opts.farVis ?? 0.5;
  const farDx = opts.farDx ?? 0.02;
  const pose: Pose = Array.from({ length: POSE_LANDMARK_COUNT }, blank);
  for (const name of Object.keys(j) as (JointName | 'nose')[]) {
    const p = j[name];
    if (!p) continue;
    if (name === 'nose') {
      pose[0] = { x: toX(p[0], aspect), y: p[1], z: 0, visibility: nearVis };
      continue;
    }
    pose[jointIndex(name, side)] = { x: toX(p[0], aspect), y: p[1], z: 0, visibility: opts.vis?.[name] ?? nearVis };
    pose[jointIndex(name, otherSide(side))] = { x: toX(p[0] + farDx, aspect), y: p[1], z: 0.1, visibility: farVis };
  }
  return pose;
}

/** Front-view figure: left/right joints given separately (x in height units). */
export function frontPose(left: Joints, right: Joints, opts: { aspect?: number; vis?: number } = {}): Pose {
  const aspect = opts.aspect ?? 1;
  const v = opts.vis ?? 0.95;
  const pose: Pose = Array.from({ length: POSE_LANDMARK_COUNT }, blank);
  for (const [side, joints] of [['left', left], ['right', right]] as const) {
    for (const name of Object.keys(joints) as (JointName | 'nose')[]) {
      const p = joints[name];
      if (!p) continue;
      const lm = { x: toX(p[0], aspect), y: p[1], z: 0, visibility: v };
      if (name === 'nose') pose[0] = lm;
      else pose[jointIndex(name, side)] = lm;
    }
  }
  return pose;
}

export function frame(landmarks: Pose | null, t: number, aspect = 1): PoseFrame {
  return { t, landmarks, aspect };
}

// --- Reference figure: floor at y=0.9, shin 0.2, thigh 0.22, torso 0.25 -----------------

export const FLOOR_Y = 0.9;

export const STANDING: Joints = {
  nose: [0.52, 0.15],
  shoulder: [0.5, 0.21],
  elbow: [0.5, 0.33],
  wrist: [0.5, 0.45],
  index: [0.5, 0.48],
  hip: [0.5, 0.46],
  knee: [0.5, 0.68],
  ankle: [0.5, 0.88],
  heel: [0.47, 0.9],
  foot_index: [0.56, 0.9],
};

/** Hips well below knees, heels flat. */
export const DEEP_SQUAT: Joints = {
  nose: [0.62, 0.5],
  shoulder: [0.55, 0.56],
  elbow: [0.62, 0.64],
  wrist: [0.66, 0.72],
  index: [0.67, 0.74],
  hip: [0.41, 0.78],
  knee: [0.62, 0.72],
  ankle: [0.5, 0.88],
  heel: [0.47, 0.9],
  foot_index: [0.56, 0.9],
};

/** Hips above knee height. */
export const SHALLOW_SQUAT: Joints = {
  ...DEEP_SQUAT,
  nose: [0.6, 0.4],
  shoulder: [0.55, 0.46],
  hip: [0.42, 0.66],
};

/** Deep squat on the toes: heels 0.06 (0.3 shins) off the floor. */
export const HEELS_UP_SQUAT: Joints = {
  ...DEEP_SQUAT,
  heel: [0.47, 0.84],
};

/** Straight-legged forward fold, fingertips on the floor. */
export const FOLD_FLOOR: Joints = {
  nose: [0.66, 0.74],
  shoulder: [0.66, 0.66],
  elbow: [0.62, 0.76],
  wrist: [0.6, 0.86],
  index: [0.6, 0.9],
  hip: [0.48, 0.47],
  knee: [0.5, 0.68],
  ankle: [0.5, 0.88],
  heel: [0.47, 0.9],
  foot_index: [0.56, 0.9],
};

/** Same reach but with knees clearly bent. */
export const FOLD_BENT_KNEES: Joints = {
  ...FOLD_FLOOR,
  knee: [0.58, 0.69],
  hip: [0.45, 0.52],
};

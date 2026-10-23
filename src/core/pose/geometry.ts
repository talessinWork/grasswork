/**
 * Pose geometry. All angles and distances are aspect-correct: x is scaled by the image aspect
 * (width / height) so both axes are measured in image-height units.
 */
import type { Calibration, JointName, Landmark, Pose, Side } from '../types';
import { LM } from '../types';
import { isUsable, jointIndex, pointOrNull } from './landmarks';

const RAD = 180 / Math.PI;

export function jointPoint(pose: Pose, joint: JointName, side: Side): Landmark {
  return pose[jointIndex(joint, side)];
}

/** Angle at b (degrees, 0..180) formed by a-b-c. */
export function angleDeg(a: Landmark, b: Landmark, c: Landmark, aspect: number): number {
  const v1x = (a.x - b.x) * aspect;
  const v1y = a.y - b.y;
  const v2x = (c.x - b.x) * aspect;
  const v2y = c.y - b.y;
  const n1 = Math.hypot(v1x, v1y);
  const n2 = Math.hypot(v2x, v2y);
  if (n1 === 0 || n2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (n1 * n2)));
  return Math.acos(cos) * RAD;
}

export function distance(a: Landmark, b: Landmark, aspect: number): number {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y);
}

/** Degrees between the vector from->to and straight up (image y grows down). 0 = up, 90 = horizontal, 180 = down. */
export function angleFromUp(from: Landmark, to: Landmark, aspect: number): number {
  const dx = (to.x - from.x) * aspect;
  const dy = to.y - from.y;
  const n = Math.hypot(dx, dy);
  if (n === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, -dy / n))) * RAD;
}

function vis(pose: Pose, i: number): number {
  const lm = pose[i];
  return lm && Number.isFinite(lm.visibility) ? lm.visibility : 0;
}

/** Side facing the camera: the one whose hip/knee/ankle visibility is higher. Ties go left. */
export function pickSide(pose: Pose): Side {
  const left = vis(pose, LM.L_HIP) + vis(pose, LM.L_KNEE) + vis(pose, LM.L_ANKLE);
  const right = vis(pose, LM.R_HIP) + vis(pose, LM.R_KNEE) + vis(pose, LM.R_ANKLE);
  return right > left ? 'right' : 'left';
}

const mid = (a: Landmark, b: Landmark): Landmark => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: (a.z + b.z) / 2,
  visibility: Math.min(a.visibility, b.visibility),
});

/** Shoulder width / torso length. Small (≈0) when side-on, ≈0.7 when facing the camera. NaN when unknown. */
export function shoulderWidthRatio(pose: Pose, aspect: number): number {
  const ls = pose[LM.L_SHOULDER];
  const rs = pose[LM.R_SHOULDER];
  const lh = pose[LM.L_HIP];
  const rh = pose[LM.R_HIP];
  if (![ls, rs, lh, rh].every((p) => isUsable(p, 0.1))) return NaN;
  const torso = distance(mid(ls, rs), mid(lh, rh), aspect);
  if (torso <= 1e-6) return NaN;
  return distance(ls, rs, aspect) / torso;
}

export const SIDE_ON_MAX_RATIO = 0.3;
export const FRONT_ON_MIN_RATIO = 0.5;

export function isSideOn(pose: Pose, aspect: number): boolean {
  const r = shoulderWidthRatio(pose, aspect);
  return Number.isFinite(r) && r < SIDE_ON_MAX_RATIO;
}

export function isFrontOn(pose: Pose, aspect: number): boolean {
  const r = shoulderWidthRatio(pose, aspect);
  return Number.isFinite(r) && r > FRONT_ON_MIN_RATIO;
}

/**
 * Upright: knee and hip nearly straight, torso near vertical. With a calibration the hip must
 * also be near its standing height above the floor.
 */
export function isStanding(pose: Pose, cal: Calibration | null, aspect: number): boolean {
  const side = pickSide(pose);
  const sh = pointOrNull(pose, 'shoulder', side);
  const hip = pointOrNull(pose, 'hip', side);
  const knee = pointOrNull(pose, 'knee', side);
  const ankle = pointOrNull(pose, 'ankle', side);
  if (!sh || !hip || !knee || !ankle) return false;
  if (angleDeg(hip, knee, ankle, aspect) < 155) return false;
  if (angleDeg(sh, hip, knee, aspect) < 150) return false;
  if (angleFromUp(hip, sh, aspect) > 30) return false;
  if (cal) {
    const legLen = cal.thigh + cal.shin;
    if (legLen > 0 && cal.floorY - hip.y < 0.85 * legLen) return false;
  }
  return true;
}

/**
 * Metric registry. Each metric reads the camera-facing side (pickSide) unless noted, and returns
 * null when a required point is missing. Vertical distances are divided by calibrated limb lengths
 * so values do not depend on how far the person stands from the camera.
 */
import type { Calibration, Landmark, MetricId, Pose } from '../types';
import { LM } from '../types';
import { angleDeg, angleFromUp, pickSide } from '../pose/geometry';
import { isUsable, pointOrNull } from '../pose/landmarks';

type MetricFn = (pose: Pose, cal: Calibration, aspect: number) => number | null;

const safeDiv = (num: number, den: number): number | null => (den > 1e-6 && Number.isFinite(num) ? num / den : null);

function mid(a: Landmark, b: Landmark): Landmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, visibility: Math.min(a.visibility, b.visibility) };
}

/** Visible hip midpoint, or the single visible hip. */
function hipCenter(pose: Pose): Landmark | null {
  const l = pose[LM.L_HIP];
  const r = pose[LM.R_HIP];
  const lu = isUsable(l);
  const ru = isUsable(r);
  if (lu && ru) return mid(l, r);
  if (lu) return l;
  if (ru) return r;
  return null;
}

const kneeAngle: MetricFn = (pose, _cal, aspect) => {
  const s = pickSide(pose);
  const hip = pointOrNull(pose, 'hip', s);
  const knee = pointOrNull(pose, 'knee', s);
  const ankle = pointOrNull(pose, 'ankle', s);
  return hip && knee && ankle ? angleDeg(hip, knee, ankle, aspect) : null;
};

const hipAngle: MetricFn = (pose, _cal, aspect) => {
  const s = pickSide(pose);
  const sh = pointOrNull(pose, 'shoulder', s);
  const hip = pointOrNull(pose, 'hip', s);
  const knee = pointOrNull(pose, 'knee', s);
  return sh && hip && knee ? angleDeg(sh, hip, knee, aspect) : null;
};

const hipBelowKnee: MetricFn = (pose, cal) => {
  const s = pickSide(pose);
  const hip = pointOrNull(pose, 'hip', s);
  const knee = pointOrNull(pose, 'knee', s);
  return hip && knee ? safeDiv(hip.y - knee.y, cal.thigh) : null;
};

const heelLift: MetricFn = (pose, cal) => {
  const heel = pointOrNull(pose, 'heel', pickSide(pose));
  return heel ? safeDiv(cal.floorY - heel.y, cal.shin) : null;
};

const fingertipToFloor: MetricFn = (pose, cal) => {
  const s = pickSide(pose);
  // the far hand is often occluded; use the camera-facing index, falling back to the other one
  const idx = pointOrNull(pose, 'index', s) ?? pointOrNull(pose, 'index', s === 'left' ? 'right' : 'left');
  return idx ? safeDiv(cal.floorY - idx.y, cal.shin) : null;
};

const torsoLean: MetricFn = (pose, _cal, aspect) => {
  const s = pickSide(pose);
  const sh = pointOrNull(pose, 'shoulder', s);
  const hip = pointOrNull(pose, 'hip', s);
  return sh && hip ? angleFromUp(hip, sh, aspect) : null;
};

/** Rear leg = the one whose knee is lower in the image (kneeling knee). 0 = thigh vertical. */
const backThighVertical: MetricFn = (pose, _cal, aspect) => {
  let best: { knee: Landmark; hip: Landmark } | null = null;
  for (const s of ['left', 'right'] as const) {
    const knee = pointOrNull(pose, 'knee', s);
    const hip = pointOrNull(pose, 'hip', s);
    if (knee && hip && (!best || knee.y > best.knee.y)) best = { knee, hip };
  }
  return best ? angleFromUp(best.knee, best.hip, aspect) : null;
};

const straddleAngle: MetricFn = (pose, _cal, aspect) => {
  const c = hipCenter(pose);
  const la = pointOrNull(pose, 'ankle', 'left');
  const ra = pointOrNull(pose, 'ankle', 'right');
  if (!c || !isUsable(pose[LM.L_HIP]) || !isUsable(pose[LM.R_HIP]) || !la || !ra) return null;
  return angleDeg(la, c, ra, aspect);
};

const shoulderFlexion: MetricFn = (pose, _cal, aspect) => {
  const s = pickSide(pose);
  const hip = pointOrNull(pose, 'hip', s);
  const sh = pointOrNull(pose, 'shoulder', s);
  const wr = pointOrNull(pose, 'wrist', s);
  return hip && sh && wr ? angleDeg(hip, sh, wr, aspect) : null;
};

const hipHeight: MetricFn = (pose, cal) => {
  const hip = pointOrNull(pose, 'hip', pickSide(pose));
  return hip ? safeDiv(cal.floorY - hip.y, cal.torso) : null;
};

export const METRICS: Record<MetricId, MetricFn> = {
  kneeAngle,
  hipAngle,
  hipBelowKnee,
  heelLift,
  fingertipToFloor,
  torsoLean,
  backThighVertical,
  straddleAngle,
  shoulderFlexion,
  hipHeight,
};

export const METRIC_IDS = Object.keys(METRICS) as MetricId[];

export function isMetricId(x: unknown): x is MetricId {
  return typeof x === 'string' && Object.prototype.hasOwnProperty.call(METRICS, x);
}

/** Internal landmark helpers shared by pose/ and evaluator/. Not part of the public contract. */
import { LM } from '../types';
import type { JointName, Landmark, Pose, Side } from '../types';

const INDEX: Record<JointName, { left: number; right: number }> = {
  shoulder: { left: LM.L_SHOULDER, right: LM.R_SHOULDER },
  elbow: { left: LM.L_ELBOW, right: LM.R_ELBOW },
  wrist: { left: LM.L_WRIST, right: LM.R_WRIST },
  index: { left: LM.L_INDEX, right: LM.R_INDEX },
  hip: { left: LM.L_HIP, right: LM.R_HIP },
  knee: { left: LM.L_KNEE, right: LM.R_KNEE },
  ankle: { left: LM.L_ANKLE, right: LM.R_ANKLE },
  heel: { left: LM.L_HEEL, right: LM.R_HEEL },
  foot_index: { left: LM.L_FOOT_INDEX, right: LM.R_FOOT_INDEX },
};

export function jointIndex(joint: JointName, side: Side): number {
  return INDEX[joint][side];
}

export const otherSide = (s: Side): Side => (s === 'left' ? 'right' : 'left');

/** Below this visibility a point is treated as missing by the metrics. */
export const MIN_METRIC_VISIBILITY = 0.3;

export function isUsable(lm: Landmark | undefined, minVis = MIN_METRIC_VISIBILITY): lm is Landmark {
  return (
    !!lm &&
    Number.isFinite(lm.x) &&
    Number.isFinite(lm.y) &&
    Number.isFinite(lm.visibility) &&
    lm.visibility >= minVis
  );
}

/** Visible above threshold and inside the image. */
export function isVisibleInFrame(lm: Landmark | undefined, threshold: number): boolean {
  return isUsable(lm, threshold) && lm.x >= 0 && lm.x <= 1 && lm.y >= 0 && lm.y <= 1;
}

/** Joint point or null when it is missing / barely visible. */
export function pointOrNull(pose: Pose, joint: JointName, side: Side, minVis = MIN_METRIC_VISIBILITY): Landmark | null {
  const lm = pose[jointIndex(joint, side)];
  return isUsable(lm, minVis) ? lm : null;
}

/** Sides whose joints must be checked for a given camera view. */
export function sidesForView(view: 'side' | 'front', picked: Side): Side[] {
  return view === 'front' ? ['left', 'right'] : [picked];
}

/** Setup checklist for the framing screen: body in view, facing the right way, enough light. */
import type { PoseFrame, StretchSpec } from '../types';
import { isFrontOn, isSideOn, pickSide } from '../pose/geometry';
import { isVisibleInFrame, jointIndex, sidesForView } from '../pose/landmarks';

export interface FramingCheck {
  wholeBody: boolean;
  orientation: boolean;
  light: boolean;
  ok: boolean;
  hint: string | null;
}

export const FRAMING_VISIBILITY = 0.6;
export const FRAMING_LIGHT_MIN = 0.75;

export const FRAMING_HINTS = {
  noPerson: 'Step into the frame',
  feet: 'Step back until your feet show',
  body: 'Step back until your whole body shows',
  sideways: 'Turn sideways',
  face: 'Face the camera',
  light: 'Find more light',
} as const;

const FOOT_JOINTS = new Set(['ankle', 'heel', 'foot_index']);

export function checkFraming(frame: PoseFrame, spec: StretchSpec): FramingCheck {
  const pose = frame.landmarks;
  if (!pose) return { wholeBody: false, orientation: false, light: false, ok: false, hint: FRAMING_HINTS.noPerson };

  const sides = sidesForView(spec.view, pickSide(pose));
  let feetMissing = false;
  let otherMissing = false;
  let visSum = 0;
  let visN = 0;
  for (const side of sides) {
    for (const j of spec.required) {
      const lm = pose[jointIndex(j, side)];
      visSum += lm && Number.isFinite(lm.visibility) ? lm.visibility : 0;
      visN++;
      if (!isVisibleInFrame(lm, FRAMING_VISIBILITY)) {
        if (FOOT_JOINTS.has(j)) feetMissing = true;
        else otherMissing = true;
      }
    }
  }
  const wholeBody = !feetMissing && !otherMissing;
  const orientation = spec.view === 'side' ? isSideOn(pose, frame.aspect) : isFrontOn(pose, frame.aspect);
  const light = visN > 0 && visSum / visN >= FRAMING_LIGHT_MIN;

  let hint: string | null = null;
  if (!wholeBody) hint = feetMissing && !otherMissing ? FRAMING_HINTS.feet : FRAMING_HINTS.body;
  else if (!orientation) hint = spec.view === 'side' ? FRAMING_HINTS.sideways : FRAMING_HINTS.face;
  else if (!light) hint = FRAMING_HINTS.light;

  return { wholeBody, orientation, light, ok: wholeBody && orientation && light, hint };
}

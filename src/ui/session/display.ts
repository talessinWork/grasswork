/**
 * Display-only mapping for the session screen: rule chip labels, depth meter range, framing copy.
 * No rules are decided here; validity always comes from the evaluator.
 */
import type { RuleSpec, StretchSpec } from '../../core/types';
import { specsForGoal } from '../../core/evaluator/specs/index';
import { FRAMING_HINTS } from '../../core/evaluator/framing';
import { CALIBRATION_HINTS } from '../../core/pose/calibration';
import { OUT_OF_FRAME_CUE } from '../../core/session/cueThrottle';

/** Positive chip label for a rule ("Heels down"), shown green when met, ember when missing. */
export function ruleLabel(rule: RuleSpec): string {
  switch (rule.id) {
    case 'heels':
      return 'Heels down';
    case 'depth':
      return rule.metric === 'hipBelowKnee' && rule.value >= 0 ? 'Hips below knees' : 'Low enough';
    case 'knees':
      return 'Knees bent';
    case 'chest':
      return 'Chest up';
    case 'straight_knees':
      return 'Knees straight';
    case 'reach':
      return 'Reaching low';
    case 'hinge':
      return 'Folding at the hips';
    case 'back_thigh':
      return 'Back thigh upright';
    default:
      return rule.cue;
  }
}

/** Live depth → 0..1 for the meter: 0 at the depth rule's entry threshold, 1 at the level target. */
export function depthFraction(spec: StretchSpec, depth: number | null): number {
  if (depth == null || !Number.isFinite(depth)) return 0;
  const entry = spec.rules.find((r) => r.metric === spec.depthMetric)?.value;
  const target = spec.targetDepth;
  let start = entry ?? target - (spec.depthBetter === 'higher' ? 1 : -1) * Math.max(0.2, Math.abs(target) * 0.5);
  if (start === target) start = target - (spec.depthBetter === 'higher' ? 0.2 : -0.2);
  const f = (depth - start) / (target - start);
  return Math.max(0, Math.min(1, f));
}

/** "Curb → Grass": the rank before this level and the rank this level earns. */
export function depthRangeLabel(spec: StretchSpec): string {
  if (!spec.goalId || !spec.rank) return 'Toward your target';
  const ladder = specsForGoal(spec.goalId);
  const prev = ladder.find((s) => s.level === spec.level - 1)?.rank ?? 'Start';
  return `${prev} → ${spec.rank}`;
}

/** Second line under the framing headline: why Gus is asking. */
export function framingDetail(hint: string | null): string {
  switch (hint) {
    case FRAMING_HINTS.sideways:
      return "Your shoulders look wide, so you're facing the camera.";
    case FRAMING_HINTS.face:
      return "Your shoulders look narrow, so you're side-on.";
    case FRAMING_HINTS.feet:
    case CALIBRATION_HINTS.feet:
      return 'Gus needs your feet to find the floor.';
    case FRAMING_HINTS.body:
    case CALIBRATION_HINTS.body:
    case CALIBRATION_HINTS.head:
      return 'Prop the phone low, about two big steps away.';
    case FRAMING_HINTS.light:
      return "Gus can't see your joints clearly. Face a window or switch on a lamp.";
    case FRAMING_HINTS.noPerson:
    case OUT_OF_FRAME_CUE:
      return 'Prop the phone on the floor and step back until you fit.';
    case CALIBRATION_HINTS.stand:
      return 'Stand up tall for a moment.';
    case CALIBRATION_HINTS.still:
      return 'Measuring the floor line. Stay still.';
    default:
      return 'Hold this spot. Starting in a moment.';
  }
}

export function orientationLabel(spec: StretchSpec): string {
  return spec.view === 'side' ? 'Side view, turn 90°' : 'Face the camera';
}

export type SilhouetteKind = 'squat' | 'fold' | 'couch' | 'split' | 'bridge' | 'overhead' | 'straddle';

export function silhouetteFor(stretchId: string): SilhouetteKind {
  if (stretchId.startsWith('fold')) return 'fold';
  if (stretchId === 'couch_stretch') return 'couch';
  return 'squat';
}

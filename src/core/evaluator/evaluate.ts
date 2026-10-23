/** Per-frame stretch evaluation: smoothing, visibility gate, orientation, rules, depth. */
import type { Calibration, EvalResult, MetricId, PoseFrame, RuleOp, StretchSpec } from '../types';
import { isFrontOn, isSideOn, isStanding, pickSide } from '../pose/geometry';
import { isVisibleInFrame, jointIndex, sidesForView } from '../pose/landmarks';
import { PoseSmoother } from '../pose/oneEuro';
import { METRICS, METRIC_IDS } from './metrics';

export interface Evaluator {
  evaluate(frame: PoseFrame): EvalResult;
  reset(): void;
}

export function compare(v: number, op: RuleOp, target: number): boolean {
  switch (op) {
    case '<':
      return v < target;
    case '<=':
      return v <= target;
    case '>':
      return v > target;
    case '>=':
      return v >= target;
  }
}

export function createEvaluator(spec: StretchSpec, cal: Calibration, opts?: { visibilityThreshold?: number }): Evaluator {
  const threshold = opts?.visibilityThreshold ?? 0.6;
  const smoother = new PoseSmoother();

  return {
    evaluate(raw: PoseFrame): EvalResult {
      const frame = smoother.smooth(raw);
      const pose = frame.landmarks;
      const empty: EvalResult = {
        t: raw.t,
        visible: false,
        orientationOk: false,
        valid: false,
        failed: [],
        cues: [],
        depth: null,
        metrics: {},
        standing: false,
      };
      if (!pose) return empty;

      const aspect = frame.aspect;
      const sides = sidesForView(spec.view, pickSide(pose));
      const visible = sides.every((s) => spec.required.every((j) => isVisibleInFrame(pose[jointIndex(j, s)], threshold)));
      const orientationOk = spec.view === 'side' ? isSideOn(pose, aspect) : isFrontOn(pose, aspect);
      const standing = isStanding(pose, cal, aspect);

      const metrics: Partial<Record<MetricId, number>> = {};
      for (const id of METRIC_IDS) {
        const v = METRICS[id](pose, cal, aspect);
        if (v !== null && Number.isFinite(v)) metrics[id] = v;
      }

      if (!visible) return { ...empty, orientationOk, metrics, standing };

      const failed: string[] = [];
      const cues: string[] = [];
      for (const rule of spec.rules) {
        const v = metrics[rule.metric];
        if (v === undefined || !compare(v, rule.op, rule.value)) {
          failed.push(rule.id);
          cues.push(rule.cue);
        }
      }
      const depth = metrics[spec.depthMetric] ?? null;
      return {
        t: raw.t,
        visible,
        orientationOk,
        valid: orientationOk && failed.length === 0,
        failed,
        cues,
        depth,
        metrics,
        standing,
      };
    },
    reset(): void {
      smoother.reset();
    },
  };
}

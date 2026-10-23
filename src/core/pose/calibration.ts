/**
 * Calibration: the person stands still, whole body in view, for durationMs. Produces the floor
 * line and limb lengths that make metrics independent of camera distance.
 */
import type { Calibration, JointName, Landmark, Pose, PoseFrame, Side } from '../types';
import { distance, isStanding, pickSide } from './geometry';
import { isVisibleInFrame, jointIndex } from './landmarks';

export interface CalibrationProgress {
  status: 'need_body' | 'hold_still' | 'done';
  progress: number;
  hint: string | null;
  calibration: Calibration | null;
}

const BODY_JOINTS: JointName[] = ['shoulder', 'hip', 'knee', 'ankle', 'heel', 'foot_index'];
const FEET: JointName[] = ['ankle', 'heel', 'foot_index'];
const TRACKED: JointName[] = ['shoulder', 'hip', 'knee', 'ankle', 'heel', 'foot_index'];
const VIS_THRESHOLD = 0.6;

export const CALIBRATION_HINTS = {
  noPerson: 'Step into the frame',
  feet: 'Step back until your feet show',
  head: 'Step back until your head shows',
  body: 'Step back until your whole body shows',
  stand: 'Stand up tall',
  still: 'Hold still',
} as const;

interface Sample {
  t: number;
  side: Side;
  aspect: number;
  /** tracked points of the picked side, in TRACKED order */
  pts: Landmark[];
  floorY: number;
}

export class Calibrator {
  private durationMs: number;
  private maxJitter: number;
  private samples: Sample[] = [];
  private result: Calibration | null = null;

  constructor(opts?: { durationMs?: number; maxJitter?: number }) {
    this.durationMs = opts?.durationMs ?? 2000;
    this.maxJitter = opts?.maxJitter ?? 0.02;
  }

  push(frame: PoseFrame): CalibrationProgress {
    if (this.result) return { status: 'done', progress: 1, hint: null, calibration: this.result };
    const pose = frame.landmarks;
    if (!pose) return this.needBody(CALIBRATION_HINTS.noPerson);

    const side = pickSide(pose);
    const missing = (j: JointName) => !isVisibleInFrame(pose[jointIndex(j, side)], VIS_THRESHOLD);
    if (FEET.some(missing)) return this.needBody(CALIBRATION_HINTS.feet);
    if (!isVisibleInFrame(pose[0], VIS_THRESHOLD)) return this.needBody(CALIBRATION_HINTS.head);
    if (BODY_JOINTS.some(missing)) return this.needBody(CALIBRATION_HINTS.body);
    if (!isStanding(pose, null, frame.aspect)) return this.needBody(CALIBRATION_HINTS.stand);

    const sample = toSample(pose, side, frame);
    if (this.samples.length > 0) {
      const ref = this.samples[0];
      const mean = meanPts(this.samples.map((s) => s.pts));
      const jitter = ref.side !== side ? Infinity : maxDeviation(sample.pts, mean, frame.aspect);
      if (jitter > this.maxJitter) {
        this.samples = [sample];
        return { status: 'hold_still', progress: 0, hint: CALIBRATION_HINTS.still, calibration: null };
      }
    }
    this.samples.push(sample);

    const elapsed = sample.t - this.samples[0].t;
    const progress = Math.max(0, Math.min(1, elapsed / this.durationMs));
    if (elapsed >= this.durationMs) {
      this.result = this.finish();
      return { status: 'done', progress: 1, hint: null, calibration: this.result };
    }
    return { status: 'hold_still', progress, hint: CALIBRATION_HINTS.still, calibration: null };
  }

  reset(): void {
    this.samples = [];
    this.result = null;
  }

  private needBody(hint: string): CalibrationProgress {
    this.samples = [];
    return { status: 'need_body', progress: 0, hint, calibration: null };
  }

  private finish(): Calibration {
    const s0 = this.samples[0];
    const pts = meanPts(this.samples.map((s) => s.pts));
    const aspect = this.samples.reduce((a, s) => a + s.aspect, 0) / this.samples.length;
    const at = (j: JointName) => pts[TRACKED.indexOf(j)];
    return {
      floorY: this.samples.reduce((a, s) => a + s.floorY, 0) / this.samples.length,
      thigh: distance(at('hip'), at('knee'), aspect),
      shin: distance(at('knee'), at('ankle'), aspect),
      torso: distance(at('shoulder'), at('hip'), aspect),
      side: s0.side,
    };
  }
}

function toSample(pose: Pose, side: Side, frame: PoseFrame): Sample {
  let floorY = -Infinity;
  for (const s of ['left', 'right'] as const) {
    for (const j of ['heel', 'foot_index'] as const) {
      const lm = pose[jointIndex(j, s)];
      if (isVisibleInFrame(lm, VIS_THRESHOLD)) floorY = Math.max(floorY, lm.y);
    }
  }
  return {
    t: frame.t,
    side,
    aspect: frame.aspect,
    pts: TRACKED.map((j) => pose[jointIndex(j, side)]),
    floorY,
  };
}

function meanPts(all: Landmark[][]): Landmark[] {
  const n = all.length;
  return all[0].map((_, i) => {
    let x = 0;
    let y = 0;
    let z = 0;
    let v = 0;
    for (const pts of all) {
      x += pts[i].x;
      y += pts[i].y;
      z += pts[i].z;
      v += pts[i].visibility;
    }
    return { x: x / n, y: y / n, z: z / n, visibility: v / n };
  });
}

function maxDeviation(pts: Landmark[], mean: Landmark[], aspect: number): number {
  let m = 0;
  for (let i = 0; i < pts.length; i++) m = Math.max(m, distance(pts[i], mean[i], aspect));
  return m;
}

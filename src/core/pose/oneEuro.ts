/** One Euro filter (Casiez et al. 2012) for jitter-free yet responsive landmark smoothing. */
import type { Landmark, PoseFrame } from '../types';

function alpha(cutoff: number, dtS: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dtS);
}

export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev = 0;

  constructor(opts?: { minCutoff?: number; beta?: number; dCutoff?: number }) {
    this.minCutoff = opts?.minCutoff ?? 1.0;
    this.beta = opts?.beta ?? 0.5;
    this.dCutoff = opts?.dCutoff ?? 1.0;
  }

  filter(x: number, tMs: number): number {
    if (this.xPrev === null || !Number.isFinite(this.xPrev)) {
      this.xPrev = x;
      this.dxPrev = 0;
      this.tPrev = tMs;
      return x;
    }
    const dt = (tMs - this.tPrev) / 1000;
    if (dt <= 0) return this.xPrev;
    const dx = (x - this.xPrev) / dt;
    const aD = alpha(this.dCutoff, dt);
    const edx = this.dxPrev + aD * (dx - this.dxPrev);
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const a = alpha(cutoff, dt);
    const xf = this.xPrev + a * (x - this.xPrev);
    this.xPrev = xf;
    this.dxPrev = edx;
    this.tPrev = tMs;
    return xf;
  }

  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = 0;
  }
}

/** Smooths x/y/z of every landmark; visibility passes through. Gaps > 1 s restart the filters. */
export class PoseSmoother {
  private opts: { minCutoff?: number; beta?: number };
  private filters: OneEuroFilter[][] = [];
  private lastT: number | null = null;

  constructor(opts?: { minCutoff?: number; beta?: number }) {
    this.opts = { minCutoff: opts?.minCutoff ?? 1.0, beta: opts?.beta ?? 0.5 };
  }

  smooth(frame: PoseFrame): PoseFrame {
    if (!frame.landmarks) return frame;
    if (this.lastT !== null && frame.t - this.lastT > 1000) this.reset();
    this.lastT = frame.t;
    const out: Landmark[] = frame.landmarks.map((lm, i) => {
      if (!this.filters[i]) {
        this.filters[i] = [new OneEuroFilter(this.opts), new OneEuroFilter(this.opts), new OneEuroFilter(this.opts)];
      }
      const [fx, fy, fz] = this.filters[i];
      return {
        x: fx.filter(lm.x, frame.t),
        y: fy.filter(lm.y, frame.t),
        z: fz.filter(lm.z, frame.t),
        visibility: lm.visibility,
      };
    });
    return { ...frame, landmarks: out };
  }

  reset(): void {
    this.filters = [];
    this.lastT = null;
  }
}

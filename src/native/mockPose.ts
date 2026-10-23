/**
 * Synthetic PoseFrame stream for the iOS Simulator (no camera) and UI development.
 *
 *   const stream = createMockPoseStream();          // stand 2.5 s -> deep squat 45 s -> stand
 *   stream.start((f) => handleFrame(f));
 *   ...
 *   stream.stop();
 *
 * Frames come from the stick figures in src/core/pose/synthetic.ts, interpolated between
 * phases and lightly jittered so smoothing / "hold still" logic behaves as on a device.
 * Plain JS timers only; no React Native imports.
 */
import type { Landmark, Pose, PoseFrame } from '../core/types';
import { POSE_LANDMARK_COUNT } from '../core/types';
import { DEEP_SQUAT, STANDING, stickPose, type Joints } from '../core/pose/synthetic';

export interface MockPhase {
  /** pose held during this phase */
  pose: Joints | 'none';
  /** how long the phase lasts, ms */
  durationMs: number;
  /** time spent blending from the previous phase's pose at the start of this one, ms (default 800) */
  transitionMs?: number;
}

export interface MockPoseScript {
  phases: MockPhase[];
  /** frames per second (default 15) */
  fps?: number;
  /** width/height of the virtual camera image (default 9/16, portrait phone) */
  aspect?: number;
  /** stddev-ish amplitude of per-landmark jitter in normalized units (default 0.003) */
  jitter?: number;
  /** restart from the first phase when the script ends (default false: keep emitting the last phase) */
  loop?: boolean;
  /** seed for the deterministic jitter (default 1) */
  seed?: number;
}

export interface MockPoseStream {
  start(onFrame: (f: PoseFrame) => void): void;
  stop(): void;
}

export const DEFAULT_MOCK_SCRIPT: MockPoseScript = {
  phases: [
    { pose: STANDING, durationMs: 2500, transitionMs: 0 },
    { pose: DEEP_SQUAT, durationMs: 45000, transitionMs: 1200 },
    { pose: STANDING, durationMs: 5000, transitionMs: 1200 },
  ],
  fps: 15,
  aspect: 9 / 16,
  jitter: 0.003,
  loop: false,
};

/** mulberry32: tiny deterministic PRNG so mock sessions are reproducible. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

function lerpPose(a: Pose, b: Pose, k: number): Pose {
  const out: Pose = new Array(POSE_LANDMARK_COUNT);
  for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
    const p = a[i];
    const q = b[i];
    out[i] = {
      x: p.x + (q.x - p.x) * k,
      y: p.y + (q.y - p.y) * k,
      z: p.z + (q.z - p.z) * k,
      visibility: p.visibility + (q.visibility - p.visibility) * k,
    };
  }
  return out;
}

/** Pose at `elapsedMs` into the script, before jitter; null for 'none' phases. */
export function mockPoseAt(script: MockPoseScript, elapsedMs: number): Pose | null {
  const aspect = script.aspect ?? DEFAULT_MOCK_SCRIPT.aspect!;
  const phases = script.phases;
  if (phases.length === 0) return null;
  const total = phases.reduce((s, p) => s + p.durationMs, 0);
  let t = elapsedMs;
  if (script.loop && total > 0) t = ((t % total) + total) % total;

  const build = (p: MockPhase): Pose | null => (p.pose === 'none' ? null : stickPose(p.pose, { aspect }));

  let start = 0;
  for (let i = 0; i < phases.length; i++) {
    const ph = phases[i];
    const end = start + ph.durationMs;
    if (t < end || i === phases.length - 1) {
      const target = build(ph);
      const prev = i > 0 ? build(phases[i - 1]) : null;
      const trans = ph.transitionMs ?? 800;
      const into = t - start;
      if (target && prev && trans > 0 && into < trans) return lerpPose(prev, target, smoothstep(into / trans));
      return target;
    }
    start = end;
  }
  return null;
}

export function createMockPoseStream(script: MockPoseScript = DEFAULT_MOCK_SCRIPT): MockPoseStream {
  const fps = script.fps ?? DEFAULT_MOCK_SCRIPT.fps!;
  const aspect = script.aspect ?? DEFAULT_MOCK_SCRIPT.aspect!;
  const jitter = script.jitter ?? DEFAULT_MOCK_SCRIPT.jitter!;
  const intervalMs = Math.max(1, Math.round(1000 / fps));

  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer != null) clearInterval(timer);
    timer = null;
  };

  const start = (onFrame: (f: PoseFrame) => void) => {
    stop();
    const rand = prng(script.seed ?? 1);
    // Monotonic clock: performance.now() where available (RN/Hermes, browsers, bun), else Date.
    const now = (): number =>
      typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();
    const t0 = now();
    let lastT = -1;

    const tick = () => {
      let t = Math.round(now());
      if (t <= lastT) t = lastT + 1; // same strictly-increasing guarantee as the native bridge
      lastT = t;
      const base = mockPoseAt(script, t - t0);
      let landmarks: Pose | null = null;
      if (base) {
        landmarks = base.map(
          (p): Landmark => ({
            x: p.x + (rand() - 0.5) * 2 * jitter,
            y: p.y + (rand() - 0.5) * 2 * jitter,
            z: p.z,
            visibility: p.visibility,
          }),
        );
      }
      onFrame({ t, landmarks, aspect });
    };

    tick();
    timer = setInterval(tick, intervalMs);
  };

  return { start, stop };
}

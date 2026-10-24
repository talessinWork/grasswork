import { describe, it, expect } from 'bun:test';
import type { Calibration, Landmark } from '../types';
import { LM } from '../types';
import {
  angleDeg,
  distance,
  isFrontOn,
  isSideOn,
  isStanding,
  jointPoint,
  pickSide,
  shoulderWidthRatio,
} from './geometry';
import { OneEuroFilter, PoseSmoother } from './oneEuro';
import { Calibrator } from './calibration';
import { DEEP_SQUAT, FLOOR_Y, STANDING, frame, frontPose, stickPose } from './synthetic';

const p = (x: number, y: number): Landmark => ({ x, y, z: 0, visibility: 1 });
const CAL: Calibration = { floorY: FLOOR_Y, thigh: 0.22, shin: 0.2, torso: 0.25, side: 'left' };

const FRONT_L = { nose: [0.5, 0.15], shoulder: [0.6, 0.21], hip: [0.56, 0.46], knee: [0.56, 0.68], ankle: [0.56, 0.88], heel: [0.56, 0.9], foot_index: [0.57, 0.9] } as const;
const FRONT_R = { shoulder: [0.4, 0.21], hip: [0.44, 0.46], knee: [0.44, 0.68], ankle: [0.44, 0.88], heel: [0.44, 0.9], foot_index: [0.43, 0.9] } as const;
const front = (aspect = 1) =>
  frontPose(
    Object.fromEntries(Object.entries(FRONT_L).map(([k, v]) => [k, [v[0], v[1]]])),
    Object.fromEntries(Object.entries(FRONT_R).map(([k, v]) => [k, [v[0], v[1]]])),
    { aspect },
  );

describe('geometry', () => {
  it('angleDeg computes the angle at b', () => {
    expect(angleDeg(p(1, 0), p(0, 0), p(0, 1), 1)).toBeCloseTo(90, 5);
    expect(angleDeg(p(0, 0), p(0.5, 0.5), p(1, 1), 1)).toBeCloseTo(180, 5);
    expect(angleDeg(p(0.5, 0), p(0, 0), p(0.5, 0.5), 1)).toBeCloseTo(45, 5);
  });

  it('angleDeg is aspect-correct', () => {
    // in a 2:1 frame, normalized dx 0.5 is twice as long as dy 0.5
    expect(angleDeg(p(0.5, 0), p(0, 0), p(0.5, 0.5), 2)).toBeCloseTo((Math.atan(0.5) * 180) / Math.PI, 5);
    // the same physical pose gives the same knee angle at any aspect
    const a1 = stickPose(DEEP_SQUAT, { aspect: 1 });
    const a2 = stickPose(DEEP_SQUAT, { aspect: 9 / 16 });
    const k = (pose: Landmark[], asp: number) => angleDeg(pose[LM.L_HIP], pose[LM.L_KNEE], pose[LM.L_ANKLE], asp);
    expect(k(a2, 9 / 16)).toBeCloseTo(k(a1, 1), 6);
  });

  it('angleDeg returns 0 for degenerate input', () => {
    expect(angleDeg(p(0, 0), p(0, 0), p(1, 1), 1)).toBe(0);
  });

  it('distance scales x by aspect', () => {
    expect(distance(p(0, 0), p(0.3, 0.4), 1)).toBeCloseTo(0.5, 6);
    expect(distance(p(0, 0), p(0.5, 0), 2)).toBeCloseTo(1, 6);
  });

  it('jointPoint maps joint + side to the landmark', () => {
    const pose = stickPose(STANDING, { side: 'right' });
    expect(jointPoint(pose, 'knee', 'right')).toBe(pose[LM.R_KNEE]);
    expect(jointPoint(pose, 'foot_index', 'left')).toBe(pose[LM.L_FOOT_INDEX]);
  });

  it('pickSide picks the more visible leg', () => {
    expect(pickSide(stickPose(STANDING, { side: 'left' }))).toBe('left');
    expect(pickSide(stickPose(STANDING, { side: 'right' }))).toBe('right');
  });

  it('isSideOn vs isFrontOn', () => {
    const side = stickPose(STANDING);
    expect(shoulderWidthRatio(side, 1)).toBeLessThan(0.3);
    expect(isSideOn(side, 1)).toBe(true);
    expect(isFrontOn(side, 1)).toBe(false);
    const f = front();
    expect(isFrontOn(f, 1)).toBe(true);
    expect(isSideOn(f, 1)).toBe(false);
    // aspect-correct: a front pose in a portrait frame is still front-on
    expect(isFrontOn(front(9 / 16), 9 / 16)).toBe(true);
  });

  it('orientation is unknown (false) when shoulders are missing', () => {
    const pose = stickPose(STANDING, { vis: { shoulder: 0 }, farVis: 0 });
    expect(isSideOn(pose, 1)).toBe(false);
    expect(isFrontOn(pose, 1)).toBe(false);
  });

  it('isStanding', () => {
    expect(isStanding(stickPose(STANDING), CAL, 1)).toBe(true);
    expect(isStanding(stickPose(STANDING), null, 1)).toBe(true);
    expect(isStanding(stickPose(DEEP_SQUAT), CAL, 1)).toBe(false);
    expect(isStanding(stickPose(DEEP_SQUAT), null, 1)).toBe(false);
  });
});

describe('OneEuroFilter / PoseSmoother', () => {
  it('passes the first sample through and smooths noise', () => {
    const f = new OneEuroFilter({ minCutoff: 1, beta: 0 });
    expect(f.filter(1, 0)).toBe(1);
    const out = f.filter(2, 33);
    expect(out).toBeGreaterThan(1);
    expect(out).toBeLessThan(2);
    f.reset();
    expect(f.filter(5, 100)).toBe(5);
  });

  it('converges to a constant signal', () => {
    const f = new OneEuroFilter();
    let v = 0;
    for (let i = 0; i < 200; i++) v = f.filter(i === 0 ? 0 : 1, i * 33);
    expect(v).toBeCloseTo(1, 3);
  });

  it('PoseSmoother smooths coordinates and keeps visibility; null frames pass through', () => {
    const s = new PoseSmoother();
    const a = stickPose(STANDING);
    const b = stickPose(STANDING).map((lm) => ({ ...lm, y: lm.y + 0.05 }));
    s.smooth(frame(a, 0));
    const out = s.smooth(frame(b, 33)).landmarks!;
    expect(out[LM.L_KNEE].y).toBeGreaterThan(a[LM.L_KNEE].y);
    expect(out[LM.L_KNEE].y).toBeLessThan(b[LM.L_KNEE].y);
    expect(out[LM.L_KNEE].visibility).toBe(b[LM.L_KNEE].visibility);
    expect(s.smooth(frame(null, 66)).landmarks).toBeNull();
    s.reset();
    expect(s.smooth(frame(b, 100)).landmarks![LM.L_KNEE].y).toBe(b[LM.L_KNEE].y);
  });
});

describe('Calibrator', () => {
  const jitter = (i: number) => stickPose(STANDING).map((lm) => ({ ...lm, x: lm.x + (i % 2 ? 0.002 : -0.002) }));

  it('completes after 2 s of standing still and measures limbs', () => {
    const c = new Calibrator();
    let r = c.push(frame(jitter(0), 0));
    expect(r.status).toBe('hold_still');
    expect(r.hint).toBe('Hold still');
    for (let t = 100; t < 2000; t += 100) {
      r = c.push(frame(jitter(t / 100), t));
      expect(r.status).toBe('hold_still');
    }
    expect(r.progress).toBeGreaterThan(0.9);
    r = c.push(frame(jitter(20), 2000));
    expect(r.status).toBe('done');
    expect(r.progress).toBe(1);
    const cal = r.calibration!;
    expect(cal.floorY).toBeCloseTo(0.9, 3);
    expect(cal.thigh).toBeCloseTo(0.22, 2);
    expect(cal.shin).toBeCloseTo(0.2, 2);
    expect(cal.torso).toBeCloseTo(0.25, 2);
    expect(cal.side).toBe('left');
    // sticky until reset
    expect(c.push(frame(null, 2100)).status).toBe('done');
    c.reset();
    expect(c.push(frame(null, 2200)).status).toBe('need_body');
  });

  it('restarts the window on movement', () => {
    const c = new Calibrator();
    for (let t = 0; t <= 1500; t += 100) c.push(frame(stickPose(STANDING), t));
    const moved = stickPose(STANDING).map((lm) => ({ ...lm, x: lm.x + 0.08 }));
    const r = c.push(frame(moved, 1600));
    expect(r.status).toBe('hold_still');
    expect(r.progress).toBe(0);
    expect(c.push(frame(moved, 2100)).status).toBe('hold_still');
    expect(c.push(frame(moved, 3600)).status).toBe('done');
  });

  it('asks for the feet / body / standing', () => {
    const c = new Calibrator();
    const noFeet = stickPose(STANDING, { vis: { heel: 0.1, foot_index: 0.1 } });
    expect(c.push(frame(noFeet, 0))).toMatchObject({ status: 'need_body', hint: 'Step back until your feet show' });
    expect(c.push(frame(null, 10)).status).toBe('need_body');
    expect(c.push(frame(stickPose(DEEP_SQUAT), 20)).hint).toBe('Stand up tall');
    const offscreen = stickPose(STANDING).map((lm, i) => (i === 0 ? { ...lm, y: -0.05 } : lm));
    expect(c.push(frame(offscreen, 30)).hint).toBe('Step back until your head shows');
  });

  it('completes when facing the camera even though the more-visible side keeps flipping', () => {
    // regression: both sides are about equally visible front-on, so picking the side per frame
    // flipped it and reset the window forever (review finding 1)
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const c = new Calibrator();
    let doneAt = -1;
    for (let t = 0; t < 10_000; t += 66) {
      const pose = front(9 / 16).map((lm) =>
        lm.visibility > 0 ? { ...lm, visibility: Math.min(1, 0.97 + (rnd() - 0.5) * 0.01) } : lm,
      );
      const r = c.push(frame(pose, t, 9 / 16));
      if (r.status === 'done') {
        doneAt = t;
        break;
      }
    }
    expect(doneAt).toBeGreaterThan(1900);
    expect(doneAt).toBeLessThan(2300);
  });

  it('respects custom durationMs', () => {
    const c = new Calibrator({ durationMs: 500 });
    c.push(frame(stickPose(STANDING), 0));
    expect(c.push(frame(stickPose(STANDING), 500)).status).toBe('done');
  });
});

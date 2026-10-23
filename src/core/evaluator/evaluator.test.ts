import { describe, it, expect } from 'bun:test';
import type { Calibration, StretchSpec } from '../types';
import { METRICS } from './metrics';
import { createEvaluator } from './evaluate';
import { checkFraming } from './framing';
import { GOALS, SPECS, formatDepth, getGoal, getSpec, specsForGoal, validateSpec } from './specs/index';
import {
  DEEP_SQUAT,
  FLOOR_Y,
  FOLD_BENT_KNEES,
  FOLD_FLOOR,
  HEELS_UP_SQUAT,
  SHALLOW_SQUAT,
  STANDING,
  frame,
  frontPose,
  stickPose,
} from '../pose/synthetic';
import type { Joints } from '../pose/synthetic';

const CAL: Calibration = { floorY: FLOOR_Y, thigh: 0.22, shin: 0.2, torso: 0.25, side: 'left' };
const m = (j: Joints, opts = {}) => stickPose(j, opts);
const run = (spec: StretchSpec, j: Joints, opts: Parameters<typeof stickPose>[1] = {}) =>
  createEvaluator(spec, CAL).evaluate(frame(stickPose(j, opts), 0, opts.aspect ?? 1));

describe('metrics', () => {
  it('kneeAngle / hipAngle', () => {
    expect(METRICS.kneeAngle(m(STANDING), CAL, 1)!).toBeCloseTo(180, 0);
    expect(METRICS.hipAngle(m(STANDING), CAL, 1)!).toBeCloseTo(180, 0);
    expect(METRICS.kneeAngle(m(DEEP_SQUAT), CAL, 1)!).toBeLessThan(45);
    expect(METRICS.hipAngle(m(FOLD_FLOOR), CAL, 1)!).toBeLessThan(60);
  });

  it('hipBelowKnee is normalized by thigh and camera-distance independent', () => {
    expect(METRICS.hipBelowKnee(m(STANDING), CAL, 1)!).toBeCloseTo(-1, 5);
    expect(METRICS.hipBelowKnee(m(DEEP_SQUAT), CAL, 1)!).toBeCloseTo(0.06 / 0.22, 5);
    // same pose at half size (person twice as far away), half-size calibration -> same value
    const half = (j: Joints): Joints =>
      Object.fromEntries(Object.entries(j).map(([k, v]) => [k, [v![0] / 2, v![1] / 2]])) as Joints;
    const cal2: Calibration = { ...CAL, floorY: FLOOR_Y / 2, thigh: 0.11, shin: 0.1, torso: 0.125 };
    expect(METRICS.hipBelowKnee(m(half(DEEP_SQUAT)), cal2, 1)!).toBeCloseTo(0.06 / 0.22, 5);
    expect(METRICS.fingertipToFloor(m(half(STANDING)), cal2, 1)!).toBeCloseTo(
      METRICS.fingertipToFloor(m(STANDING), CAL, 1)!,
      5,
    );
  });

  it('heelLift', () => {
    expect(METRICS.heelLift(m(DEEP_SQUAT), CAL, 1)!).toBeCloseTo(0, 5);
    expect(METRICS.heelLift(m(HEELS_UP_SQUAT), CAL, 1)!).toBeCloseTo(0.3, 5);
  });

  it('fingertipToFloor', () => {
    expect(METRICS.fingertipToFloor(m(STANDING), CAL, 1)!).toBeCloseTo(2.1, 5);
    expect(METRICS.fingertipToFloor(m(FOLD_FLOOR), CAL, 1)!).toBeCloseTo(0, 5);
    const palms = { ...FOLD_FLOOR, index: [0.62, 0.92] } as Joints;
    expect(METRICS.fingertipToFloor(m(palms), CAL, 1)!).toBeLessThan(0);
  });

  it('torsoLean', () => {
    expect(METRICS.torsoLean(m(STANDING), CAL, 1)!).toBeCloseTo(0, 5);
    expect(METRICS.torsoLean(m(FOLD_FLOOR), CAL, 1)!).toBeGreaterThan(40);
  });

  it('backThighVertical uses the lower (kneeling) knee', () => {
    const left: Joints = { shoulder: [0.5, 0.4], hip: [0.5, 0.6], knee: [0.5, 0.88], ankle: [0.3, 0.88] };
    const right: Joints = { shoulder: [0.5, 0.4], hip: [0.5, 0.6], knee: [0.7, 0.62], ankle: [0.7, 0.88] };
    const pose = frontPose(left, right);
    expect(METRICS.backThighVertical(pose, CAL, 1)!).toBeCloseTo(0, 5);
    const leaning = frontPose({ ...left, hip: [0.6, 0.78] }, right);
    expect(METRICS.backThighVertical(leaning, CAL, 1)!).toBeGreaterThan(30);
  });

  it('straddleAngle (front view)', () => {
    const l: Joints = { hip: [0.55, 0.5], ankle: [0.85, 0.8] };
    const r: Joints = { hip: [0.45, 0.5], ankle: [0.15, 0.8] };
    expect(METRICS.straddleAngle(frontPose(l, r), CAL, 1)!).toBeCloseTo((2 * Math.atan2(0.35, 0.3) * 180) / Math.PI, 5);
  });

  it('shoulderFlexion', () => {
    expect(METRICS.shoulderFlexion(m(STANDING), CAL, 1)!).toBeCloseTo(0, 5);
    const overhead = { ...STANDING, wrist: [0.5, 0.0] } as Joints;
    expect(METRICS.shoulderFlexion(m(overhead), CAL, 1)!).toBeCloseTo(180, 5);
  });

  it('hipHeight', () => {
    expect(METRICS.hipHeight(m(STANDING), CAL, 1)!).toBeCloseTo(0.44 / 0.25, 5);
  });

  it('returns null when required points are missing', () => {
    const blind = m(STANDING, { nearVis: 0, farVis: 0 });
    for (const fn of Object.values(METRICS)) expect(fn(blind, CAL, 1)).toBeNull();
    const noHeel = m(STANDING, { vis: { heel: 0 }, farVis: 0 });
    expect(METRICS.heelLift(noHeel, CAL, 1)).toBeNull();
    expect(METRICS.kneeAngle(noHeel, CAL, 1)).not.toBeNull();
  });
});

describe('evaluator', () => {
  const deep = getSpec('deep_squat');

  it('deep squat passes Grass', () => {
    const r = run(deep, DEEP_SQUAT);
    expect(r.visible).toBe(true);
    expect(r.orientationOk).toBe(true);
    expect(r.failed).toEqual([]);
    expect(r.valid).toBe(true);
    expect(r.depth).toBeCloseTo(0.06 / 0.22, 2);
    expect(r.standing).toBe(false);
    expect(r.metrics.kneeAngle).toBeDefined();
  });

  it('shallow squat fails with "Sit lower"', () => {
    const r = run(deep, SHALLOW_SQUAT);
    expect(r.valid).toBe(false);
    expect(r.failed).toContain('depth');
    expect(r.cues[0]).toBe('Sit lower');
  });

  it('heels-up squat fails Grass but passes Bench', () => {
    const r = run(deep, HEELS_UP_SQUAT);
    expect(r.valid).toBe(false);
    expect(r.failed).toEqual(['heels']);
    expect(r.cues).toEqual(['Keep your heels down']);
    expect(run(getSpec('squat_heels_raised'), HEELS_UP_SQUAT).valid).toBe(true);
  });

  it('cues follow spec order', () => {
    const r = run(deep, { ...SHALLOW_SQUAT, heel: [0.47, 0.84] });
    const order = deep.rules.map((x) => x.id).filter((id) => r.failed.includes(id));
    expect(r.failed).toEqual(order);
    expect(r.failed[0]).toBe('heels');
    expect(r.cues).toEqual(deep.rules.filter((x) => r.failed.includes(x.id)).map((x) => x.cue));
  });

  it('standing is detected', () => {
    const r = run(deep, STANDING);
    expect(r.standing).toBe(true);
    expect(r.valid).toBe(false);
  });

  it('works the same on the right side and in a portrait frame', () => {
    expect(run(deep, DEEP_SQUAT, { side: 'right' }).valid).toBe(true);
    expect(run(deep, DEEP_SQUAT, { aspect: 9 / 16 }).valid).toBe(true);
  });

  it('visibility gate', () => {
    const r = run(deep, DEEP_SQUAT, { vis: { heel: 0.4 } });
    expect(r.visible).toBe(false);
    expect(r.valid).toBe(false);
    expect(r.depth).toBeNull();
    expect(r.failed).toEqual([]);
    const lowered = createEvaluator(deep, CAL, { visibilityThreshold: 0.3 }).evaluate(
      frame(stickPose(DEEP_SQUAT, { vis: { heel: 0.4 } }), 0),
    );
    expect(lowered.visible).toBe(true);
  });

  it('no person -> invalid', () => {
    const r = createEvaluator(deep, CAL).evaluate(frame(null, 5));
    expect(r).toMatchObject({ t: 5, visible: false, valid: false, depth: null, standing: false });
  });

  it('orientation: facing the camera invalidates a side-view stretch', () => {
    const r = run(deep, DEEP_SQUAT, { farDx: 0.2 });
    expect(r.visible).toBe(true);
    expect(r.orientationOk).toBe(false);
    expect(r.failed).toEqual([]);
    expect(r.valid).toBe(false);
  });

  it('fold to the floor passes, bent knees are rejected', () => {
    const floor = getSpec('fold_floor');
    expect(run(floor, FOLD_FLOOR).valid).toBe(true);
    expect(run(getSpec('fold_knees'), FOLD_FLOOR).valid).toBe(true);
    expect(run(getSpec('fold_palms'), FOLD_FLOOR).valid).toBe(false);
    for (const s of specsForGoal('forward_fold')) {
      const r = run(s, FOLD_BENT_KNEES);
      expect(r.valid).toBe(false);
      expect(r.failed[0]).toBe('straight_knees');
      expect(r.cues[0]).toBe('Straighten your knees');
    }
  });

  it('smooths across frames and reset() clears the filter', () => {
    const ev = createEvaluator(deep, CAL);
    ev.evaluate(frame(stickPose(SHALLOW_SQUAT), 0));
    const lagged = ev.evaluate(frame(stickPose(DEEP_SQUAT), 33));
    expect(lagged.depth!).toBeLessThan(0.06 / 0.22 - 0.01);
    ev.reset();
    const fresh = ev.evaluate(frame(stickPose(DEEP_SQUAT), 66));
    expect(fresh.depth!).toBeCloseTo(0.06 / 0.22, 5);
  });
});

describe('checkFraming', () => {
  const deep = getSpec('deep_squat');
  it('ok when side-on, visible and bright', () => {
    expect(checkFraming(frame(stickPose(STANDING), 0), deep)).toEqual({
      wholeBody: true,
      orientation: true,
      light: true,
      ok: true,
      hint: null,
    });
  });
  it('feet missing', () => {
    const r = checkFraming(frame(stickPose(STANDING, { vis: { heel: 0.2, foot_index: 0.2 } }), 0), deep);
    expect(r.wholeBody).toBe(false);
    expect(r.hint).toBe('Step back until your feet show');
  });
  it('turn sideways / face the camera', () => {
    const r = checkFraming(frame(stickPose(STANDING, { farDx: 0.2 }), 0), deep);
    expect(r.orientation).toBe(false);
    expect(r.hint).toBe('Turn sideways');
    const frontSpec: StretchSpec = { ...deep, id: 'x', view: 'front' };
    const r2 = checkFraming(frame(stickPose(STANDING, { farVis: 0.95 }), 0), frontSpec);
    expect(r2.hint).toBe('Face the camera');
  });
  it('low light', () => {
    const r = checkFraming(frame(stickPose(STANDING, { nearVis: 0.65 }), 0), deep);
    expect(r.wholeBody).toBe(true);
    expect(r.light).toBe(false);
    expect(r.ok).toBe(false);
    expect(r.hint).toBe('Find more light');
  });
  it('no person', () => {
    expect(checkFraming(frame(null, 0), deep).ok).toBe(false);
  });
});

describe('specs', () => {
  it('has every contract id', () => {
    const ids = [
      'squat_chair', 'squat_heels_raised', 'squat_curb', 'deep_squat',
      'fold_knees', 'fold_shins', 'fold_ankles', 'fold_floor', 'fold_palms',
      'couch_stretch', 'squat_sit',
    ];
    expect(SPECS.map((s) => s.id).sort()).toEqual([...ids].sort());
    for (const id of ids) expect(getSpec(id).id).toBe(id);
    expect(getSpec('couch_stretch').perSide).toBe(true);
    expect(getSpec('couch_stretch').goalId).toBeNull();
    expect(() => getSpec('nope')).toThrow();
  });

  it('specsForGoal is sorted by level with matching ranks', () => {
    expect(specsForGoal('deep_squat').map((s) => s.id)).toEqual(['squat_chair', 'squat_heels_raised', 'squat_curb', 'deep_squat']);
    expect(specsForGoal('forward_fold').map((s) => s.rank)).toEqual(getGoal('forward_fold').ranks);
    expect(specsForGoal('deep_squat').map((s) => s.rank)).toEqual(getGoal('deep_squat').ranks);
    expect(specsForGoal('bridge')).toEqual([]);
  });

  it('sane fields', () => {
    for (const s of SPECS) {
      expect(s.defaultHoldS).toBeGreaterThanOrEqual(30);
      expect(s.defaultHoldS).toBeLessThanOrEqual(40);
      expect(s.instructions.includes('\n')).toBe(false);
      expect(s.rules.length).toBeGreaterThan(0);
    }
    for (const s of specsForGoal('forward_fold')) {
      expect(s.depthBetter).toBe('lower');
      expect(s.rules.find((r) => r.metric === 'kneeAngle')).toMatchObject({ op: '>=', value: 165 });
    }
    for (const s of specsForGoal('deep_squat')) expect(s.depthBetter).toBe('higher');
    // targets get harder with level
    const fold = specsForGoal('forward_fold').map((s) => s.targetDepth);
    expect([...fold].sort((a, b) => b - a)).toEqual(fold);
    expect(getSpec('fold_palms').targetDepth).toBeLessThan(0);
    const sq = specsForGoal('deep_squat').map((s) => s.targetDepth);
    expect([...sq].sort((a, b) => a - b)).toEqual(sq);
  });

  it('validateSpec rejects unknown metrics', () => {
    const bad = { ...getSpec('deep_squat'), rules: [{ id: 'x', metric: 'bogus', op: '<', value: 1, cue: 'x' }] };
    expect(() => validateSpec(bad as unknown as StretchSpec)).toThrow(/unknown metric/);
  });

  it('GOALS metadata', () => {
    expect(GOALS.map((g) => g.id).sort()).toEqual(['bridge', 'deep_squat', 'forward_fold', 'front_split', 'overhead_reach', 'straddle']);
    expect(GOALS.filter((g) => g.available).map((g) => g.id)).toEqual(['deep_squat', 'forward_fold']);
    expect(getGoal('forward_fold')).toMatchObject({ bossName: 'The Floor', unit: 'cm to floor', referenceLabel: 'floor' });
    expect(getGoal('deep_squat')).toMatchObject({ unit: 'cm below knee', referenceLabel: 'knee height' });
  });

  it('formatDepth', () => {
    const deep = getSpec('deep_squat');
    const fold = getSpec('fold_floor');
    expect(formatDepth(deep, 0.2)).toBe('9 cm below knee');
    expect(formatDepth(deep, -0.2)).toBe('9 cm above knee');
    expect(formatDepth(deep, 0)).toBe('at knee height');
    expect(formatDepth(fold, 0.3)).toBe('12 cm to floor');
    expect(formatDepth(fold, -0.1)).toBe('4 cm past floor');
    expect(formatDepth(fold, 0)).toBe('touching the floor');
    expect(formatDepth(getSpec('couch_stretch'), 12.4)).toBe('12°');
    expect(formatDepth(fold, NaN)).toBe('–');
  });
});

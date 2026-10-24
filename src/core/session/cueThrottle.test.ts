import { describe, it, expect } from 'bun:test';
import type { EvalResult } from '../types';
import { createCueThrottle } from './cueThrottle';

function ev(p: Partial<EvalResult> = {}): EvalResult {
  return { t: 0, visible: true, orientationOk: true, valid: false, failed: [], cues: [], depth: null, metrics: {}, standing: false, ...p };
}

describe('cueThrottle', () => {
  it('returns null when valid or no cues', () => {
    const c = createCueThrottle();
    expect(c.next(ev({ valid: true, cues: ['Sit lower'] }), 0)).toBeNull();
    expect(c.next(ev({ cues: [] }), 0)).toBeNull();
    expect(c.next(ev({ cues: ['Sit lower'] }), 0)).toBe('Sit lower');
  });

  it('says "Turn sideways" first when visible but facing the wrong way', () => {
    const c = createCueThrottle();
    expect(c.next(ev({ orientationOk: false, cues: [] }), 0)).toBe('Turn sideways');
    expect(c.next(ev({ orientationOk: false, cues: ['Sit lower'] }), 3000)).toBe('Sit lower');
    expect(createCueThrottle({ orientationCue: 'Face the camera' }).next(ev({ orientationOk: false }), 0)).toBe('Face the camera');
  });

  it('prioritises the first cue and enforces minGap', () => {
    const c = createCueThrottle();
    expect(c.next(ev({ cues: ['A', 'B'] }), 0)).toBe('A');
    expect(c.next(ev({ cues: ['C'] }), 2999)).toBeNull();
    expect(c.next(ev({ cues: ['C'] }), 3000)).toBe('C');
  });

  it('does not repeat the same cue within sameCueGap', () => {
    const c = createCueThrottle();
    expect(c.next(ev({ cues: ['A'] }), 0)).toBe('A');
    expect(c.next(ev({ cues: ['A'] }), 3000)).toBeNull();
    expect(c.next(ev({ cues: ['A', 'B'] }), 3000)).toBe('B');
    expect(c.next(ev({ cues: ['A'] }), 5999)).toBeNull();
    expect(c.next(ev({ cues: ['A'] }), 6000)).toBe('A');
  });

  it('says "Move into frame" when not visible, throttled', () => {
    const c = createCueThrottle({ minGapMs: 1000, sameCueGapMs: 4000 });
    expect(c.next(ev({ visible: false }), 0)).toBe('Move into frame');
    expect(c.next(ev({ visible: false }), 500)).toBeNull();
    expect(c.next(ev({ visible: false }), 1500)).toBeNull();
    expect(c.next(ev({ visible: false }), 4000)).toBe('Move into frame');
  });

  it('reset clears history', () => {
    const c = createCueThrottle();
    c.next(ev({ cues: ['A'] }), 0);
    c.reset();
    expect(c.next(ev({ cues: ['A'] }), 10)).toBe('A');
  });
});

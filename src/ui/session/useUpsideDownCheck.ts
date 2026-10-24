/**
 * Dev-only sanity check for the native orientation handling: if the whole body is visible but the nose
 * sits below both ankles for ~2 s, the frames are almost certainly rotated 180° (see the FIRST-BUILD CHECK
 * in the native plugins). Subscribes to the FrameStore directly so it costs no per-frame re-render; state
 * only changes when the verdict flips. Always false in release builds.
 */
import { useEffect, useState } from 'react';
import { LM } from '../../core/types';
import type { FrameStore } from './frameStore';

const SUSTAIN_MS = 2000;
const MIN_VIS = 0.6;

export function useUpsideDownCheck(frames: FrameStore, enabled: boolean): boolean {
  const [upsideDown, setUpsideDown] = useState(false);

  useEffect(() => {
    if (!__DEV__ || !enabled) {
      setUpsideDown(false);
      return;
    }
    let since: number | null = null;
    let flagged = false;
    let warned = false;
    const check = () => {
      const f = frames.get();
      const lm = f?.landmarks;
      if (!f || !lm) return;
      const nose = lm[LM.NOSE];
      const la = lm[LM.L_ANKLE];
      const ra = lm[LM.R_ANKLE];
      const bodyVisible = !!nose && !!la && !!ra && nose.visibility >= MIN_VIS && la.visibility >= MIN_VIS && ra.visibility >= MIN_VIS;
      if (!bodyVisible) return; // no verdict without a clearly visible person
      const inverted = nose.y > la.y && nose.y > ra.y;
      if (inverted) {
        if (since == null) since = f.t;
        if (!flagged && f.t - since >= SUSTAIN_MS) {
          flagged = true;
          setUpsideDown(true);
          if (!warned) {
            warned = true;
            console.warn('[pose] Pose looks upside down (nose below ankles for 2 s): check orientation handling in the native plugin.');
          }
        }
      } else {
        since = null;
        if (flagged) {
          flagged = false;
          setUpsideDown(false);
        }
      }
    };
    return frames.subscribe(check);
  }, [frames, enabled]);

  return upsideDown;
}

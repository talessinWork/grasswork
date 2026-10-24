/** Latest pose frame, outside React state, so only the skeleton overlay re-renders at camera rate. */
import { useSyncExternalStore } from 'react';
import type { PoseFrame } from '../../core/types';

export interface FrameStore {
  get(): PoseFrame | null;
  set(f: PoseFrame | null): void;
  subscribe(cb: () => void): () => void;
}

export function createFrameStore(): FrameStore {
  let frame: PoseFrame | null = null;
  const subs = new Set<() => void>();
  return {
    get: () => frame,
    set(f) {
      frame = f;
      subs.forEach((cb) => cb());
    },
    subscribe(cb) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };
}

export function useLatestFrame(store: FrameStore): PoseFrame | null {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

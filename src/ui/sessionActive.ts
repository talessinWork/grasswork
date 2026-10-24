/**
 * Module-level "a session screen is mounted" flag. The session screen sets it on mount / clears it on
 * unmount; the root layout's notification handler reads it to keep reminder banners off the camera.
 * A counter rather than a boolean, so an overlapping mount/unmount during a transition can't clear it early.
 */
let mounted = 0;

export function markSessionMounted(): () => void {
  mounted += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    mounted = Math.max(0, mounted - 1);
  };
}

export function isSessionActive(): boolean {
  return mounted > 0;
}

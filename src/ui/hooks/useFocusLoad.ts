import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

export interface Loaded<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload(): Promise<void>;
}

/**
 * Runs `load` whenever the screen gains focus (and when `deps` change while focused).
 * Keeps the previous data while refetching so screens don't flash.
 */
export function useFocusLoad<T>(load: () => Promise<T>, deps: readonly unknown[] = []): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    try {
      const value = await load();
      if (id === seq.current) {
        setData(value);
        setError(null);
      }
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, deps);

  useFocusEffect(
    useCallback(() => {
      run();
      return () => {
        // invalidate in-flight loads when the screen blurs
        seq.current++;
      };
    }, [run]),
  );

  return { data, error, loading, reload: run };
}

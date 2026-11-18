/**
 * Runs an async load from a `useEffect` and applies the result only while the component is still
 * mounted. Returns the effect's cleanup.
 *
 * A load can outlive its component (e.g. the store closes while a reload is in flight). Once the
 * component is gone its result, and its error, have nowhere to go, so both are dropped instead of
 * surfacing as an unhandled rejection. Errors while still mounted are rethrown as before.
 */
export function loadWhileMounted<T>(load: () => Promise<T>, apply: (value: T) => void): () => void {
  let live = true;
  void load().then(
    (value) => {
      if (live) apply(value);
    },
    (error: unknown) => {
      if (live) throw error;
    },
  );
  return () => {
    live = false;
  };
}

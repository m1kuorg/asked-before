// Loads what a screen shows: `data` once it's here, `error` if it failed,
// `loading` while a request runs, and `retry`, which repeats the same
// request (data already shown stays through the retry, so a known count
// holds). `load` gets an AbortSignal that's aborted when its deps change or
// the screen goes, and nothing it answers after that is drawn. `setData`
// shows a change the screen made itself, such as a renamed shelf.
//
//   const shelf = useResource(() => client.shelves.get(params.shelfId), [params.shelfId]);
//   if (isNotFound(shelf.error)) notFound();

import { useCallback, useEffect, useRef, useState, type DependencyList, type Dispatch, type SetStateAction } from "react";

export type Resource<T> = {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  retry: () => void;
  setData: Dispatch<SetStateAction<T | undefined>>;
};

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, deps: DependencyList): Resource<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(load);
  latest.current = load;
  const lastAttempt = useRef(attempt);

  useEffect(() => {
    const retrying = lastAttempt.current !== attempt;
    lastAttempt.current = attempt;
    if (!retrying) setData(undefined);
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    latest.current(controller.signal).then(
      (value) => {
        if (controller.signal.aborted) return;
        setData(() => value);
        setLoading(false);
      },
      (reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason);
        setLoading(false);
      },
    );
    return () => controller.abort();
    // The caller's deps decide when to load again, as with useEffect.
  }, [...deps, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, error, loading, retry, setData };
}

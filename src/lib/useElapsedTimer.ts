import { useLayoutEffect, useState } from "react";

/** Ticks every 250ms while running; freezes once finished or paused.
 * pausedDurationMs (accumulated completed pause spans) is always subtracted
 * so paused time never counts toward the displayed elapsed time. */
export function useElapsedTimer(
  startedAt: number,
  finishedAt: number | null,
  pausedAt: number | null,
  pausedDurationMs: number,
): number {
  const [now, setNow] = useState(() => Date.now());

  // useLayoutEffect, not useEffect: `now` stops updating while frozen
  // (finished/paused), so the render right after resuming would otherwise
  // use a stale pre-pause `now` — which, combined with the just-grown
  // pausedDurationMs, computes an elapsed value that looks like it rewound
  // by roughly the pause length until the first 250ms tick corrects it.
  // Resyncing synchronously before paint means that stale value is never
  // actually painted.
  useLayoutEffect(() => {
    if (finishedAt !== null || pausedAt !== null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [finishedAt, pausedAt]);

  const end = finishedAt ?? pausedAt ?? now;
  return end - startedAt - pausedDurationMs;
}

import { useEffect, useState } from "react";

/** Ticks every 250ms while finishedAt is null; freezes once it's set. */
export function useElapsedTimer(startedAt: number, finishedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (finishedAt !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [finishedAt]);

  return (finishedAt ?? now) - startedAt;
}

import { formatElapsed } from "../lib/format";
import { useElapsedTimer } from "../lib/useElapsedTimer";

interface Props {
  startedAt: number;
  finishedAt: number | null;
  solvedCount: number;
  total: number;
}

/** Ticks its own elapsed-time state every 250ms. Deliberately kept as the
 * only thing that ticks — earlier this lived in App and was threaded down
 * as a plain `elapsedMs` prop, which meant the timer re-rendered App (and
 * therefore the whole ~1900-shape map and ~1747-cell table) four times a
 * second regardless of whether the user was doing anything, competing with
 * input handling for the main thread. */
export function StatsBar({ startedAt, finishedAt, solvedCount, total }: Props) {
  const elapsedMs = useElapsedTimer(startedAt, finishedAt);
  return (
    <div className="stats-bar">
      <span className="stats-time">{formatElapsed(elapsedMs)}</span>
      <span className="stats-score">
        {solvedCount} / {total}
      </span>
    </div>
  );
}

import { formatElapsed } from "../lib/format";

interface Props {
  elapsedMs: number;
  solvedCount: number;
  total: number;
}

export function StatsBar({ elapsedMs, solvedCount, total }: Props) {
  return (
    <div className="stats-bar">
      <span className="stats-time">{formatElapsed(elapsedMs)}</span>
      <span className="stats-score">
        {solvedCount} / {total}
      </span>
    </div>
  );
}

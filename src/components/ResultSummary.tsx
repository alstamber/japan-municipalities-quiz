import { formatElapsed } from "../lib/format";

interface Props {
  elapsedMs: number;
  solvedCount: number;
  total: number;
}

export function ResultSummary({ elapsedMs, solvedCount, total }: Props) {
  const allSolved = solvedCount === total;
  return (
    <div className="result-summary">
      <p className="result-headline">{allSolved ? "全問正解！" : "ギブアップしました"}</p>
      <p>
        正解数: {solvedCount} / {total}
      </p>
      <p>経過時間: {formatElapsed(elapsedMs)}</p>
    </div>
  );
}

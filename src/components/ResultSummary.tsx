import { formatElapsed } from "../lib/format";

interface Props {
  elapsedMs: number;
  solvedCount: number;
  total: number;
  wrongCount: number;
  onRetryWrong: () => void;
  onStartFull: () => void;
}

export function ResultSummary({ elapsedMs, solvedCount, total, wrongCount, onRetryWrong, onStartFull }: Props) {
  const allSolved = solvedCount === total;
  return (
    <div className="result-summary">
      <p className="result-headline">{allSolved ? "全問正解！" : "ギブアップしました"}</p>
      <p>
        正解数: {solvedCount} / {total}
      </p>
      <p>経過時間: {formatElapsed(elapsedMs)}</p>
      <div className="result-actions">
        {wrongCount > 0 && (
          <button type="button" className="result-action-button" onClick={onRetryWrong}>
            間違えた{wrongCount}件を再挑戦
          </button>
        )}
        <button type="button" className="result-action-button" onClick={onStartFull}>
          最初から全件やり直す
        </button>
      </div>
    </div>
  );
}

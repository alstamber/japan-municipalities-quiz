interface Props {
  onResume: () => void;
}

export function PauseOverlay({ onResume }: Props) {
  return (
    <div className="pause-overlay">
      <p className="pause-overlay-message">一時停止中</p>
      <button
        type="button"
        className="result-action-button pause-overlay-resume-button"
        onClick={onResume}
        autoFocus
      >
        再開する
      </button>
    </div>
  );
}

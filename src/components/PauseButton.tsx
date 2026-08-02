interface Props {
  disabled: boolean;
  onPause: () => void;
}

export function PauseButton({ disabled, onPause }: Props) {
  return (
    <button type="button" className="give-up-button" disabled={disabled} onClick={onPause}>
      一時停止
    </button>
  );
}

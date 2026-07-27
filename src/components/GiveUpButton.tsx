interface Props {
  disabled: boolean;
  onGiveUp: () => void;
}

export function GiveUpButton({ disabled, onGiveUp }: Props) {
  const handleClick = () => {
    if (window.confirm("ギブアップしますか？未回答の市区町村を一括で表示し、タイマーを止めます。")) {
      onGiveUp();
    }
  };

  return (
    <button type="button" className="give-up-button" disabled={disabled} onClick={handleClick}>
      ギブアップ
    </button>
  );
}

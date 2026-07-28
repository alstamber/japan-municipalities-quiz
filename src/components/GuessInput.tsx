import { useRef, type ChangeEvent } from "react";
import { normalize } from "../lib/romaji";
import type { EntryStatus } from "../types";

interface Props {
  canonicalMap: Map<string, string[]>;
  status: Record<string, EntryStatus>;
  disabled: boolean;
  onMatch: (codes: string[]) => void;
}

// Deliberately uncontrolled: an onChange-driven `value` state would put every
// keystroke (including every Backspace while deleting a wrong guess) through
// a React render+commit, even though nothing visible needs React to run for
// non-matching input. Reading e.target.value and clearing via the DOM ref
// keeps typing exactly as cheap as a plain <input> — React only gets
// involved for the one keystroke that actually completes a match.
export function GuessInput({ canonicalMap, status, disabled, onMatch }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const key = normalize(e.target.value);
    if (!key) return;

    const codes = canonicalMap.get(key);
    if (!codes) return;

    const unsolved = codes.filter((code) => status[code] === "blank");
    if (unsolved.length > 0) {
      onMatch(unsolved);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      className="guess-input"
      defaultValue=""
      onChange={handleChange}
      disabled={disabled}
      placeholder="ローマ字で市区町村名を入力"
      autoFocus
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
    />
  );
}

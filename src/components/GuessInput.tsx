import { useState, type ChangeEvent } from "react";
import { normalize } from "../lib/romaji";
import type { EntryStatus } from "../types";

interface Props {
  canonicalMap: Map<string, string[]>;
  status: Record<string, EntryStatus>;
  disabled: boolean;
  onMatch: (codes: string[]) => void;
}

export function GuessInput({ canonicalMap, status, disabled, onMatch }: Props) {
  const [value, setValue] = useState("");

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setValue(raw);

    const key = normalize(raw);
    if (!key) return;

    const codes = canonicalMap.get(key);
    if (!codes) return;

    const unsolved = codes.filter((code) => status[code] === "blank");
    if (unsolved.length > 0) {
      onMatch(unsolved);
      setValue("");
    }
  };

  return (
    <input
      type="text"
      className="guess-input"
      value={value}
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

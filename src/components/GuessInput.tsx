import { useRef, type ChangeEvent, type CompositionEvent } from "react";
import { normalize, foldKana } from "../lib/romaji";
import type { EntryStatus } from "../types";

interface Props {
  canonicalMap: Map<string, string[]>;
  kanaMap: Map<string, string[]>;
  status: Record<string, EntryStatus>;
  disabled: boolean;
  onMatch: (codes: string[]) => void;
}

// Deliberately uncontrolled: an onChange-driven `value` state would put every
// keystroke (including every Backspace while deleting a wrong guess) through
// a React render+commit, even though nothing visible needs React to run for
// non-matching input. Reading e.target.value and clearing via the DOM ref
// keeps typing exactly as cheap as a plain <input> — React only gets
// involved for the one keystroke that actually completes a match. This also
// sidesteps the classic React+IME bug class (forcing `value` from state
// desyncs the browser's composition buffer) since we never set `.value` from
// a render.
export function GuessInput({ canonicalMap, kanaMap, status, disabled, onMatch }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Tracked ourselves rather than trusting only e.nativeEvent.isComposing —
  // Safari has a history of reporting isComposing unreliably on input events
  // fired during an active IME composition.
  const isComposingRef = useRef(false);

  const tryMatch = (rawValue: string) => {
    // Re-checked here, not just by the caller: a deferred (post-
    // compositionend) match must not fire if a new composition has already
    // started in the interim.
    if (isComposingRef.current) return;

    const romajiKey = normalize(rawValue);
    const kanaKey = foldKana(rawValue.trim());
    // `x && map.get(x)` short-circuits to the falsy string "" (not undefined)
    // when the key itself is empty, which `??` would treat as already-found
    // and never fall through to the kana lookup — so branch explicitly.
    const codes = (romajiKey ? canonicalMap.get(romajiKey) : undefined) ?? (kanaKey ? kanaMap.get(kanaKey) : undefined);
    if (!codes) return;

    const unsolved = codes.filter((code) => status[code] === "blank");
    if (unsolved.length > 0) {
      onMatch(unsolved);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (isComposingRef.current || (e.nativeEvent as InputEvent).isComposing) return;
    tryMatch(e.target.value);
  };

  const handleCompositionEnd = (_e: CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    // Some WebKit versions fire compositionend slightly before the
    // element's .value is fully updated to the committed text — defer one
    // tick so we read the settled value rather than a stale pre-commit one.
    queueMicrotask(() => tryMatch(inputRef.current?.value ?? ""));
  };

  return (
    <input
      ref={inputRef}
      type="text"
      className="guess-input"
      defaultValue=""
      onChange={handleChange}
      onCompositionStart={() => {
        isComposingRef.current = true;
      }}
      onCompositionEnd={handleCompositionEnd}
      disabled={disabled}
      placeholder="ローマ字またはひらがなで市区町村名を入力"
      autoFocus
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
    />
  );
}

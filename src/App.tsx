import { useMemo, useReducer, useState } from "react";
import { MUNICIPALITIES } from "./data/municipalities.generated";
import { buildCanonicalMap } from "./lib/romaji";
import { useElapsedTimer } from "./lib/useElapsedTimer";
import { createSessionState, reducer } from "./lib/session";
import { GuessInput } from "./components/GuessInput";
import { JapanMap } from "./components/JapanMap";
import { MunicipalityTable } from "./components/MunicipalityTable";
import { GiveUpButton } from "./components/GiveUpButton";
import "./App.css";

const PREFECTURES = (() => {
  const seen = new Map<number, string>();
  for (const m of MUNICIPALITIES) {
    if (!seen.has(m.prefOrder)) seen.set(m.prefOrder, m.prefName);
  }
  return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([prefOrder, prefName]) => ({ prefOrder, prefName }));
})();

function App() {
  const [state, dispatch] = useReducer(reducer, null, createSessionState);
  const [selectedPrefOrder, setSelectedPrefOrder] = useState<number | null>(null);
  const canonicalMap = useMemo(() => buildCanonicalMap(MUNICIPALITIES), []);
  const elapsedMs = useElapsedTimer(state.startedAt, state.finishedAt);

  const total = useMemo(
    () => Object.values(state.status).filter((s) => s !== "inactive" && s !== "excluded").length,
    [state.status],
  );
  const solvedCount = useMemo(
    () => Object.values(state.status).filter((s) => s === "solved").length,
    [state.status],
  );
  const wrongCount = useMemo(
    () => Object.values(state.status).filter((s) => s === "given-up").length,
    [state.status],
  );
  const isRetryMode = useMemo(() => Object.values(state.status).some((s) => s === "inactive"), [state.status]);
  const isPrefectureMode = useMemo(
    () => Object.values(state.status).some((s) => s === "excluded"),
    [state.status],
  );
  const visibleMunicipalities = useMemo(
    () => MUNICIPALITIES.filter((m) => state.status[m.cityCode] !== "excluded"),
    [state.status],
  );

  const finished = state.finishedAt !== null;
  const hasUnsavedProgress = !finished && solvedCount > 0;

  const handleRetryWrong = () => {
    const wrongCodes = Object.entries(state.status)
      .filter(([, s]) => s === "given-up")
      .map(([code]) => code);
    dispatch({ type: "startSession", targetCodes: wrongCodes, outOfScopeStatus: "inactive" });
  };

  const handleStartFull = () => {
    setSelectedPrefOrder(null);
    dispatch({ type: "startSession", targetCodes: null });
  };

  const handlePrefectureChange = (value: string) => {
    if (hasUnsavedProgress && !window.confirm("現在の進捗は破棄されます。よろしいですか？")) {
      return;
    }
    if (value === "") {
      setSelectedPrefOrder(null);
      dispatch({ type: "startSession", targetCodes: null });
      return;
    }
    const prefOrder = Number(value);
    const codes = MUNICIPALITIES.filter((m) => m.prefOrder === prefOrder).map((m) => m.cityCode);
    setSelectedPrefOrder(prefOrder);
    dispatch({ type: "startSession", targetCodes: codes, outOfScopeStatus: "excluded" });
  };

  const selectedPrefName = PREFECTURES.find((p) => p.prefOrder === selectedPrefOrder)?.prefName;

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          全市区町村ローマ字入力クイズ
          {isRetryMode && <span className="mode-badge">復習モード</span>}
          {!isRetryMode && isPrefectureMode && selectedPrefName && (
            <span className="mode-badge">{selectedPrefName}のみ</span>
          )}
        </h1>
        <div className="controls">
          <GuessInput
            canonicalMap={canonicalMap}
            status={state.status}
            disabled={finished}
            onMatch={(codes) => dispatch({ type: "solve", codes })}
          />
          <GiveUpButton disabled={finished} onGiveUp={() => dispatch({ type: "giveUp" })} />
        </div>
        <select
          className="pref-select"
          value={selectedPrefOrder ?? ""}
          onChange={(e) => handlePrefectureChange(e.target.value)}
        >
          <option value="">全国（1747件）</option>
          {PREFECTURES.map((p) => (
            <option key={p.prefOrder} value={p.prefOrder}>
              {p.prefName}のみ
            </option>
          ))}
        </select>
      </header>
      <div className="main-content">
        <JapanMap
          status={state.status}
          elapsedMs={elapsedMs}
          solvedCount={solvedCount}
          total={total}
          finished={finished}
          wrongCount={wrongCount}
          onRetryWrong={handleRetryWrong}
          onStartFull={handleStartFull}
        />
        <MunicipalityTable municipalities={visibleMunicipalities} status={state.status} />
      </div>
    </div>
  );
}

export default App;

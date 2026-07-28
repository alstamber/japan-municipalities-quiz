import { useMemo, useReducer, useState } from "react";
import { MUNICIPALITIES } from "./data/municipalities.generated";
import { buildCanonicalMap, buildKanaMap } from "./lib/romaji";
import { createSessionState, reducer } from "./lib/session";
import { GuessInput } from "./components/GuessInput";
import { JapanMap } from "./components/JapanMap";
import { MunicipalityTable } from "./components/MunicipalityTable";
import { GiveUpButton } from "./components/GiveUpButton";
import "./App.css";

const PREFECTURES = (() => {
  const seen = new Map<number, { prefName: string; prefCode: string }>();
  for (const m of MUNICIPALITIES) {
    if (!seen.has(m.prefOrder)) seen.set(m.prefOrder, { prefName: m.prefName, prefCode: m.prefCode });
  }
  return [...seen.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([prefOrder, { prefName, prefCode }]) => ({ prefOrder, prefName, prefCode }));
})();

function App() {
  const [state, dispatch] = useReducer(reducer, null, createSessionState);
  const [selectedPrefOrder, setSelectedPrefOrder] = useState<number | null>(null);
  const canonicalMap = useMemo(() => buildCanonicalMap(MUNICIPALITIES), []);
  const kanaMap = useMemo(() => buildKanaMap(MUNICIPALITIES), []);

  // Single pass over the 1747 statuses instead of five separate
  // filter/some calls — this runs on every solved match, so every avoided
  // full-array scan (and, for visibleMunicipalities, avoided re-allocation)
  // helps keep typing responsive.
  const { total, solvedCount, wrongCount, isRetryMode, isPrefectureMode } = useMemo(() => {
    let total = 0;
    let solvedCount = 0;
    let wrongCount = 0;
    let isRetryMode = false;
    let isPrefectureMode = false;
    for (const s of Object.values(state.status)) {
      switch (s) {
        case "solved":
          solvedCount++;
          total++;
          break;
        case "given-up":
          wrongCount++;
          total++;
          break;
        case "blank":
          total++;
          break;
        case "inactive":
          isRetryMode = true;
          break;
        case "excluded":
          isPrefectureMode = true;
          break;
      }
    }
    return { total, solvedCount, wrongCount, isRetryMode, isPrefectureMode };
  }, [state.status]);

  // Reuse the constant MUNICIPALITIES reference when nothing is excluded
  // (the common full/retry-mode case) so MunicipalityTable's own grouping
  // memo can bail out entirely instead of re-grouping an equivalent list.
  const visibleMunicipalities = useMemo(
    () => (isPrefectureMode ? MUNICIPALITIES.filter((m) => state.status[m.cityCode] !== "excluded") : MUNICIPALITIES),
    [state.status, isPrefectureMode],
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

  const selectedPref = PREFECTURES.find((p) => p.prefOrder === selectedPrefOrder);

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          全市区町村クイズ
          {isRetryMode && isPrefectureMode && selectedPref && (
            <span className="mode-badge">{selectedPref.prefName}・復習モード</span>
          )}
          {isRetryMode && !isPrefectureMode && <span className="mode-badge">復習モード</span>}
          {!isRetryMode && isPrefectureMode && selectedPref && (
            <span className="mode-badge">{selectedPref.prefName}のみ</span>
          )}
        </h1>
        <div className="controls">
          <GuessInput
            canonicalMap={canonicalMap}
            kanaMap={kanaMap}
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
          startedAt={state.startedAt}
          finishedAt={state.finishedAt}
          solvedCount={solvedCount}
          total={total}
          wrongCount={wrongCount}
          onRetryWrong={handleRetryWrong}
          onStartFull={handleStartFull}
          focusPrefCode={selectedPref?.prefCode ?? null}
        />
        <MunicipalityTable municipalities={visibleMunicipalities} status={state.status} />
      </div>
    </div>
  );
}

export default App;

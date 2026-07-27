import { useMemo, useReducer } from "react";
import { MUNICIPALITIES } from "./data/municipalities.generated";
import { buildCanonicalMap } from "./lib/romaji";
import { useElapsedTimer } from "./lib/useElapsedTimer";
import { createSessionState, reducer } from "./lib/session";
import { GuessInput } from "./components/GuessInput";
import { JapanMap } from "./components/JapanMap";
import { MunicipalityTable } from "./components/MunicipalityTable";
import { GiveUpButton } from "./components/GiveUpButton";
import "./App.css";

function App() {
  const [state, dispatch] = useReducer(reducer, null, createSessionState);
  const canonicalMap = useMemo(() => buildCanonicalMap(MUNICIPALITIES), []);
  const elapsedMs = useElapsedTimer(state.startedAt, state.finishedAt);

  const total = useMemo(
    () => Object.values(state.status).filter((s) => s !== "inactive").length,
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

  const finished = state.finishedAt !== null;

  const handleRetryWrong = () => {
    const wrongCodes = Object.entries(state.status)
      .filter(([, s]) => s === "given-up")
      .map(([code]) => code);
    dispatch({ type: "startSession", targetCodes: wrongCodes });
  };

  const handleStartFull = () => {
    dispatch({ type: "startSession", targetCodes: null });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          全市区町村ローマ字入力クイズ
          {isRetryMode && <span className="mode-badge">復習モード</span>}
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
        <MunicipalityTable municipalities={MUNICIPALITIES} status={state.status} />
      </div>
    </div>
  );
}

export default App;

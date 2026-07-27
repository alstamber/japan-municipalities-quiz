import { useMemo, useReducer } from "react";
import { MUNICIPALITIES } from "./data/municipalities.generated";
import { buildCanonicalMap } from "./lib/romaji";
import { useElapsedTimer } from "./lib/useElapsedTimer";
import { GuessInput } from "./components/GuessInput";
import { JapanMap } from "./components/JapanMap";
import { MunicipalityTable } from "./components/MunicipalityTable";
import { StatsBar } from "./components/StatsBar";
import { GiveUpButton } from "./components/GiveUpButton";
import { ResultSummary } from "./components/ResultSummary";
import type { EntryStatus } from "./types";
import "./App.css";

const TOTAL = MUNICIPALITIES.length;

interface State {
  status: Record<string, EntryStatus>;
  startedAt: number;
  finishedAt: number | null;
}

type Action = { type: "solve"; codes: string[] } | { type: "giveUp" };

function createInitialState(): State {
  const status: Record<string, EntryStatus> = {};
  for (const m of MUNICIPALITIES) status[m.cityCode] = "blank";
  return { status, startedAt: Date.now(), finishedAt: null };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "solve": {
      const status = { ...state.status };
      let changed = false;
      for (const code of action.codes) {
        if (status[code] === "blank") {
          status[code] = "solved";
          changed = true;
        }
      }
      if (!changed) return state;

      const allSolved = Object.values(status).every((s) => s === "solved");
      const finishedAt = allSolved ? Date.now() : state.finishedAt;
      return { ...state, status, finishedAt };
    }
    case "giveUp": {
      if (state.finishedAt !== null) return state;
      const status = { ...state.status };
      for (const code in status) {
        if (status[code] === "blank") status[code] = "given-up";
      }
      return { ...state, status, finishedAt: Date.now() };
    }
  }
}

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const canonicalMap = useMemo(() => buildCanonicalMap(MUNICIPALITIES), []);
  const elapsedMs = useElapsedTimer(state.startedAt, state.finishedAt);

  const solvedCount = useMemo(
    () => Object.values(state.status).filter((s) => s === "solved").length,
    [state.status],
  );

  const finished = state.finishedAt !== null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>全市区町村ローマ字入力クイズ</h1>
        <StatsBar elapsedMs={elapsedMs} solvedCount={solvedCount} total={TOTAL} />
        <div className="controls">
          <GuessInput
            canonicalMap={canonicalMap}
            status={state.status}
            disabled={finished}
            onMatch={(codes) => dispatch({ type: "solve", codes })}
          />
          <GiveUpButton disabled={finished} onGiveUp={() => dispatch({ type: "giveUp" })} />
        </div>
        {finished && <ResultSummary elapsedMs={elapsedMs} solvedCount={solvedCount} total={TOTAL} />}
      </header>
      <div className="main-content">
        <JapanMap status={state.status} />
        <MunicipalityTable municipalities={MUNICIPALITIES} status={state.status} />
      </div>
    </div>
  );
}

export default App;

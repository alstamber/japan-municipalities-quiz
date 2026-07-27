import { MUNICIPALITIES } from "../data/municipalities.generated";
import type { EntryStatus } from "../types";

export interface State {
  status: Record<string, EntryStatus>;
  startedAt: number;
  finishedAt: number | null;
}

export type Action =
  | { type: "solve"; codes: string[] }
  | { type: "giveUp" }
  | { type: "startSession"; targetCodes: string[] | null };

/** targetCodes === null means the full 1747-municipality session; otherwise
 * only those codes start "blank" and everything else is "inactive" (used
 * for the "retry only what I got wrong" mode). */
export function createSessionState(targetCodes: string[] | null): State {
  const targetSet = targetCodes ? new Set(targetCodes) : null;
  const status: Record<string, EntryStatus> = {};
  for (const m of MUNICIPALITIES) {
    status[m.cityCode] = !targetSet || targetSet.has(m.cityCode) ? "blank" : "inactive";
  }
  return { status, startedAt: Date.now(), finishedAt: null };
}

export function reducer(state: State, action: Action): State {
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

      const allSolved = Object.values(status).every((s) => s === "solved" || s === "inactive");
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
    case "startSession":
      return createSessionState(action.targetCodes);
  }
}

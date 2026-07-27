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
  | { type: "startSession"; targetCodes: string[] | null; outOfScopeStatus?: "inactive" | "excluded" };

/** targetCodes === null means the full 1747-municipality session; otherwise
 * only those codes start "blank" and everything else gets outOfScopeStatus:
 * "inactive" (already known-correct — used for "retry only what I got
 * wrong", which shows those inline in the table) or "excluded" (simply not
 * part of this session, correctness unknown — used for per-prefecture mode,
 * which hides those from the table entirely). */
export function createSessionState(
  targetCodes: string[] | null,
  outOfScopeStatus: "inactive" | "excluded" = "excluded",
): State {
  const targetSet = targetCodes ? new Set(targetCodes) : null;
  const status: Record<string, EntryStatus> = {};
  for (const m of MUNICIPALITIES) {
    status[m.cityCode] = !targetSet || targetSet.has(m.cityCode) ? "blank" : outOfScopeStatus;
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

      const allSolved = Object.values(status).every(
        (s) => s === "solved" || s === "inactive" || s === "excluded",
      );
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
      return createSessionState(action.targetCodes, action.outOfScopeStatus);
  }
}

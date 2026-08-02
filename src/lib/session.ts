import { MUNICIPALITIES } from "../data/municipalities.generated";
import type { EntryStatus } from "../types";

export interface State {
  status: Record<string, EntryStatus>;
  startedAt: number;
  finishedAt: number | null;
  pausedAt: number | null;
  pausedDurationMs: number;
}

export type Action =
  | { type: "solve"; codes: string[] }
  | { type: "giveUp" }
  | { type: "startSession"; targetCodes: string[] | null; outOfScopeStatus?: "inactive" | "excluded" }
  | { type: "pause" }
  | { type: "resume" };

/** targetCodes === null means the full 1747-municipality session; otherwise
 * only those codes start "blank" and everything else gets outOfScopeStatus:
 * "inactive" (already known-correct — used for "retry only what I got
 * wrong", which shows those inline in the table) or "excluded" (simply not
 * part of this session, correctness unknown — used for per-prefecture mode,
 * which hides those from the table entirely).
 *
 * previousStatus (the status record from before this session started) lets
 * an already-"excluded" municipality stay "excluded" even when it falls
 * outside the new target set with outOfScopeStatus "inactive" — otherwise,
 * retrying-wrong from within a prefecture-scoped session would overwrite
 * every OTHER prefecture's "excluded" entries with "inactive" and the
 * session would silently balloon back into a full-country one. */
export function createSessionState(
  targetCodes: string[] | null,
  outOfScopeStatus: "inactive" | "excluded" = "excluded",
  previousStatus?: Record<string, EntryStatus>,
): State {
  const targetSet = targetCodes ? new Set(targetCodes) : null;
  const status: Record<string, EntryStatus> = {};
  for (const m of MUNICIPALITIES) {
    if (!targetSet || targetSet.has(m.cityCode)) {
      status[m.cityCode] = "blank";
    } else {
      status[m.cityCode] = previousStatus?.[m.cityCode] === "excluded" ? "excluded" : outOfScopeStatus;
    }
  }
  return { status, startedAt: Date.now(), finishedAt: null, pausedAt: null, pausedDurationMs: 0 };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "solve": {
      if (state.pausedAt !== null) return state;
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
      if (state.finishedAt !== null || state.pausedAt !== null) return state;
      const status = { ...state.status };
      for (const code in status) {
        if (status[code] === "blank") status[code] = "given-up";
      }
      return { ...state, status, finishedAt: Date.now() };
    }
    case "startSession":
      return createSessionState(action.targetCodes, action.outOfScopeStatus, state.status);
    case "pause": {
      if (state.finishedAt !== null || state.pausedAt !== null) return state;
      return { ...state, pausedAt: Date.now() };
    }
    case "resume": {
      if (state.pausedAt === null) return state;
      return { ...state, pausedAt: null, pausedDurationMs: state.pausedDurationMs + (Date.now() - state.pausedAt) };
    }
  }
}

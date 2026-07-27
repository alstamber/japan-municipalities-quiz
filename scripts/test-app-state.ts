import { MUNICIPALITIES } from "../src/data/municipalities.generated";
import { createSessionState, reducer, type State } from "../src/lib/session";

let failures = 0;
function check(label: string, cond: boolean) {
  if (!cond) {
    failures++;
    console.error(`FAIL ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

function countBy(state: State) {
  const counts: Record<string, number> = { blank: 0, solved: 0, "given-up": 0, inactive: 0, excluded: 0 };
  for (const s of Object.values(state.status)) counts[s]++;
  return counts;
}

// 1. Full session: give up after solving a few, check counts.
let state = createSessionState(null);
check("full session starts with 1747 blank", countBy(state).blank === MUNICIPALITIES.length);

const someCodes = MUNICIPALITIES.slice(0, 10).map((m) => m.cityCode);
state = reducer(state, { type: "solve", codes: someCodes });
check("solving 10 codes marks them solved", countBy(state).solved === 10);
check("not finished yet", state.finishedAt === null);

state = reducer(state, { type: "giveUp" });
const afterGiveUp = countBy(state);
check("give up marks the rest given-up", afterGiveUp["given-up"] === MUNICIPALITIES.length - 10);
check("solved count preserved through give-up", afterGiveUp.solved === 10);
check("finished after give-up", state.finishedAt !== null);

// 2. Retry wrong: start a new session scoped to exactly the given-up codes.
const wrongCodes = Object.entries(state.status)
  .filter(([, s]) => s === "given-up")
  .map(([code]) => code);
check("wrongCodes count matches given-up count", wrongCodes.length === MUNICIPALITIES.length - 10);

let retryState = reducer(state, { type: "startSession", targetCodes: wrongCodes, outOfScopeStatus: "inactive" });
const retryCounts = countBy(retryState);
check("retry session: blank count == wrongCodes count", retryCounts.blank === wrongCodes.length);
check("retry session: inactive count == originally-solved count", retryCounts.inactive === 10);
check("retry session: not finished, timer reset", retryState.finishedAt === null);

// 3. Solving everything in retry mode should auto-finish (inactive doesn't block completion).
retryState = reducer(retryState, { type: "solve", codes: wrongCodes });
check("retry session auto-finishes once all non-inactive are solved", retryState.finishedAt !== null);
check(
  "retry session: solved count == wrongCodes count",
  Object.values(retryState.status).filter((s) => s === "solved").length === wrongCodes.length,
);

// 4. Recursive retry: give up partway through a retry session, then retry the new (smaller) wrong set.
let retry2 = reducer(createSessionState(wrongCodes, "inactive"), { type: "solve", codes: wrongCodes.slice(0, 5) });
retry2 = reducer(retry2, { type: "giveUp" });
const retry2WrongCodes = Object.entries(retry2.status)
  .filter(([, s]) => s === "given-up")
  .map(([code]) => code);
check("recursive retry: second-round wrong set is smaller", retry2WrongCodes.length === wrongCodes.length - 5);

const retry3 = reducer(retry2, {
  type: "startSession",
  targetCodes: retry2WrongCodes,
  outOfScopeStatus: "inactive",
});
const retry3Counts = countBy(retry3);
check("recursive retry: third session scoped to only the still-wrong codes", retry3Counts.blank === retry2WrongCodes.length);
check(
  "recursive retry: everything else is inactive",
  retry3Counts.inactive === MUNICIPALITIES.length - retry2WrongCodes.length,
);

// 5. Reset to full from within a retry session.
const backToFull = reducer(retry3, { type: "startSession", targetCodes: null });
check("reset to full: all 1747 blank again", countBy(backToFull).blank === MUNICIPALITIES.length);
check("reset to full: no inactive entries", countBy(backToFull).inactive === 0);

// 6. Solving after finished (both give-up and full-solve) should be a no-op.
const finishedFull = reducer(createSessionState(null), { type: "giveUp" });
const afterNoOpSolve = reducer(finishedFull, { type: "solve", codes: [MUNICIPALITIES[0].cityCode] });
check("solving after finish is a no-op", afterNoOpSolve === finishedFull);

// 7. Prefecture mode: default outOfScopeStatus is "excluded", not "inactive".
const hokkaidoCodes = MUNICIPALITIES.filter((m) => m.prefOrder === 1).map((m) => m.cityCode);
let prefState = createSessionState(hokkaidoCodes);
const prefCounts = countBy(prefState);
check("prefecture session: blank count == prefecture size", prefCounts.blank === hokkaidoCodes.length);
check(
  "prefecture session: everything else is excluded, not inactive",
  prefCounts.excluded === MUNICIPALITIES.length - hokkaidoCodes.length && prefCounts.inactive === 0,
);

// Solving the whole prefecture should auto-finish (excluded doesn't block completion either).
prefState = reducer(prefState, { type: "solve", codes: hokkaidoCodes });
check("prefecture session auto-finishes once the whole prefecture is solved", prefState.finishedAt !== null);

// Give up partway through a prefecture session, then retry-wrong should stay
// scoped to that prefecture's mistakes (not the whole country).
let prefGiveUp = reducer(createSessionState(hokkaidoCodes), {
  type: "solve",
  codes: hokkaidoCodes.slice(0, 3),
});
prefGiveUp = reducer(prefGiveUp, { type: "giveUp" });
const prefWrongCodes = Object.entries(prefGiveUp.status)
  .filter(([, s]) => s === "given-up")
  .map(([code]) => code);
check(
  "prefecture give-up: wrong codes are a subset of the prefecture, not the whole country",
  prefWrongCodes.length === hokkaidoCodes.length - 3 &&
    prefWrongCodes.every((c) => hokkaidoCodes.includes(c)),
);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);

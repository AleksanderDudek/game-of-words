// ═══════════════════════════════════════════════════════════════
// Coop Mode Rules — everyone versus the word list
// ═══════════════════════════════════════════════════════════════
//
// The competitive levers are replaced by shared ones:
//
//   shared guess pool   one pool per word instead of per player, so a wasted
//                       guess costs the table — that's what makes players
//                       actually talk before answering.
//   shared bank         hint costs come out of the group's points, and ANY
//                       player may buy, not only whoever holds the mic.
//   lives               failing a word costs a life instead of ending the run;
//                       the group plays until the lives are gone.
//
// The run is graded at the end (co-op games reward a performance, not a winner).

/**
 * Shared guesses for one word. Scales with the table so bigger groups still get
 * a turn each, without handing them a pool so deep that failure is impossible.
 */
export function coopGuessPool(playerCount: number, base: number): number {
  return Math.max(2, base + Math.max(0, playerCount));
}

/** Run grading lives in shared/ so the result screen can use the same scale. */
export { coopGrade } from "../../shared/coop";
export type { CoopGrade } from "../../shared/coop";

/** True when the run is over because the group ran out of lives. */
export function coopRunFailed(livesLeft: number): boolean {
  return livesLeft <= 0;
}

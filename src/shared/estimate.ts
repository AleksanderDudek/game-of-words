// ═══════════════════════════════════════════════════════════════
// Session length estimator — shared by the lobby UI and the server
// ═══════════════════════════════════════════════════════════════
//
// A round almost never burns its whole clock: somebody usually solves the
// word part-way through. So an estimate built from `words × roundSeconds`
// would be wildly pessimistic. Instead each round is modelled as a fraction
// of its clock, with a fast/typical/slow spread that becomes the range the
// host sees.
//
// The numbers below are deliberately coarse. They exist to let a host say
// "that's about half an hour" with confidence, not to predict a specific
// game to the second.

import type { GameMode } from "./types";
import type { DurationBand } from "./rules";

/** Share of the round clock a word actually consumes before it resolves. */
const SOLVE_FRACTION = {
  fast: 0.35,
  typical: 0.68,
  slow: 1.0, // nobody solves it; the clock runs out
} as const;

/** Chance a team round fails its attack and opens a steal window. */
const STEAL_LIKELIHOOD = { fast: 0, typical: 0.3, slow: 1 } as const;

/** The pause between rounds while the solved word is on screen (session.ts). */
export const INTER_ROUND_SEC = 3;

export interface EstimateInput {
  /** Words (= rounds) the run will play through. */
  words: number;
  /** Seconds on the clock per word. */
  roundSeconds: number;
  mode: GameMode;
  /** Lobby countdown, paid once at the start of the run. */
  countdownSeconds?: number;
  /** Team mode steal window, if this mode has one. */
  stealSeconds?: number;
}

export interface DurationEstimate {
  /** Everyone solves fast. */
  lowSec: number;
  /** The number to show as *the* estimate. */
  expectedSec: number;
  /** Every word runs the clock out. */
  highSec: number;
}

type Pace = keyof typeof SOLVE_FRACTION;

function paceSeconds(input: EstimateInput, pace: Pace): number {
  const { words, roundSeconds, mode, countdownSeconds = 0, stealSeconds = 0 } = input;
  if (words <= 0) return 0;

  let perRound = roundSeconds * SOLVE_FRACTION[pace] + INTER_ROUND_SEC;
  if (mode === "team" && stealSeconds > 0) {
    perRound += stealSeconds * STEAL_LIKELIHOOD[pace];
  }
  return Math.round(words * perRound + countdownSeconds);
}

/** Fast / typical / slow wall-clock length for a configured run. */
export function estimateDuration(input: EstimateInput): DurationEstimate {
  return {
    lowSec: paceSeconds(input, "fast"),
    expectedSec: paceSeconds(input, "typical"),
    highSec: paceSeconds(input, "slow"),
  };
}

// ─── Band fit ───

export type BandFit = "under" | "fits" | "over";

/**
 * Where the expected length lands against the target band. The band is
 * treated as satisfied when the *expected* run falls inside it — judging by
 * the extremes would flag almost every selection as a mismatch.
 */
export function fitBand(estimate: DurationEstimate, band: DurationBand): BandFit {
  const minutes = estimate.expectedSec / 60;
  if (minutes < band.minMinutes) return "under";
  if (minutes > band.maxMinutes) return "over";
  return "fits";
}

/**
 * Words needed to land in the middle of a band at the given round length.
 * This is what the lobby offers when a host picks a band — a starting point
 * they can then nudge, not a lock.
 */
export function wordsForBand(band: DurationBand, input: Omit<EstimateInput, "words">): number {
  const probe = { ...input, words: 1 };
  const perRound = paceSeconds(probe, "typical") - (input.countdownSeconds ?? 0);
  if (perRound <= 0) return 1;

  const targetSec = ((band.minMinutes + band.maxMinutes) / 2) * 60 - (input.countdownSeconds ?? 0);
  return Math.max(1, Math.round(targetSec / perRound));
}

// ─── Presentation ───

/** "8 min", "1h 05m" — compact enough for a lobby chip. */
export function formatDuration(totalSec: number): string {
  const minutes = Math.max(0, Math.round(totalSec / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${String(rest).padStart(2, "0")}m`;
}

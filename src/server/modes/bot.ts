// ═══════════════════════════════════════════════════════════════
// Solo Mode — heuristic bot rival
// ═══════════════════════════════════════════════════════════════
//
// The bot obviously knows the answer, so "skill" is simulated rather than
// computed: on each of its guesses it rolls against a solve probability, and
// when the roll fails it plays a decoy that looks like a genuine attempt.
//
// The probability is shaped by the same things that make a word hard for a
// human — length and how many letter pairs are still scrambled — so the bot
// gets visibly better as the board gets easier, which reads as thinking.
//
// "adaptive" is the recommended default: it rubber-bands toward the player's
// score, which keeps a practice session close without ever feeling unbeatable.
//
// Pacing is budgeted per *turn*, not per guess. The rival shares the player's
// round clock and the time bonus scored off it, so however many guesses a turn
// holds, they all come out of one envelope — see botTurnBudgetMs below.

import type { BotDifficulty, LetterCell } from "../../shared/types";

export interface BotProfile {
  /** Chance to solve on a single guess before board modifiers */
  readonly baseAccuracy: number;
  /** Chance to spend points on revealing a pair when it can afford to */
  readonly hintChance: number;
  /** Share of the turn budget this difficulty spends thinking (0..1) */
  readonly pace: number;
}

const PROFILES: Record<Exclude<BotDifficulty, "adaptive">, BotProfile> = {
  easy:   { baseAccuracy: 0.16, hintChance: 0.05, pace: 1.0 },
  normal: { baseAccuracy: 0.32, hintChance: 0.15, pace: 0.8 },
  hard:   { baseAccuracy: 0.55, hintChance: 0.28, pace: 0.5 },
};

const ADAPTIVE_PROFILE: BotProfile = {
  baseAccuracy: 0.30,
  hintChance: 0.18,
  pace: 0.8,
};

/**
 * Shortest pause worth showing. Anything quicker and the guess lands under the
 * client's 500ms miss animation, so the round reads as a glitch rather than a move.
 */
const MIN_STEP_MS = 400;

/** How wide the per-guess pause may wander around its share of the budget. */
const STEP_JITTER = 0.25;

export function botProfile(difficulty: BotDifficulty): BotProfile {
  return difficulty === "adaptive" ? ADAPTIVE_PROFILE : PROFILES[difficulty];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface BotSolveInput {
  difficulty: BotDifficulty;
  wordLength: number;
  minWordLength: number;
  /** Scrambled pairs still hidden on the board */
  remainingPairs: number;
  playerScore: number;
  botScore: number;
}

/**
 * Base accuracy for the round. Fixed difficulties are constant; "adaptive"
 * tracks the score gap so the bot sharpens up when it falls behind and eases
 * off when it pulls ahead.
 */
export function botBaseAccuracy(input: BotSolveInput): number {
  const profile = botProfile(input.difficulty);
  if (input.difficulty !== "adaptive") return profile.baseAccuracy;
  const gap = input.playerScore - input.botScore;
  return clamp(profile.baseAccuracy + gap * 0.0004, 0.12, 0.68);
}

/**
 * Probability the bot solves the word on this particular guess.
 * Longer words are harder; a board with most pairs already revealed is easier.
 */
export function botSolveProbability(input: BotSolveInput): number {
  const base = botBaseAccuracy(input);
  const lengthPenalty = clamp(1 - (input.wordLength - input.minWordLength) * 0.035, 0.35, 1);
  const pairsPenalty = clamp(1 - input.remainingPairs * 0.07, 0.4, 1);
  return clamp(base * lengthPenalty * pairsPenalty, 0.03, 0.92);
}

/**
 * Wall-clock the bot may spend on one *whole* turn, however many guesses that
 * turn holds. Budgeting the turn rather than the guess is what keeps the rival
 * off the shared round clock — a slower profile now reads as slower pacing
 * inside the same envelope instead of a longer wait for the player.
 */
export function botTurnBudgetMs(difficulty: BotDifficulty, budgetMs: number): number {
  return Math.round(Math.max(0, budgetMs) * botProfile(difficulty).pace);
}

/**
 * Pause before the bot's next guess: an even share of whatever budget the turn
 * has left, nudged by a little jitter so the rhythm is not metronomic.
 *
 * The share is taken from the *remaining* budget, so a long first guess is paid
 * for by the ones after it and the turn total can never overrun. `MIN_STEP_MS`
 * is the one thing that may push past the budget, and only when a host has set
 * an unusually deep guess pool — a readable move beats a strict envelope.
 */
export function botStepDelayMs(
  budgetLeftMs: number,
  guessesLeft: number,
  rng: () => number = Math.random,
): number {
  const left = Math.max(0, budgetLeftMs);
  if (left === 0) return 0;

  const share = left / Math.max(1, guessesLeft);
  const jittered = share * (1 - STEP_JITTER + rng() * STEP_JITTER * 2);
  return Math.round(clamp(jittered, Math.min(MIN_STEP_MS, left), left));
}

export interface BotHintInput {
  difficulty: BotDifficulty;
  botScore: number;
  hintCost: number;
  remainingPairs: number;
}

/** The bot buys a reveal only when it is affordable and the board is still messy. */
export function shouldBotBuyHint(input: BotHintInput, rng: () => number = Math.random): boolean {
  if (input.botScore < input.hintCost) return false;
  if (input.remainingPairs < 2) return false;
  return rng() < botProfile(input.difficulty).hintChance;
}

/**
 * A wrong answer that still looks like a real attempt: the board as the bot
 * sees it, with one more pair of letters transposed. Never returns the actual
 * solution — a decoy that happens to be correct would score by accident.
 */
export function makeDecoyGuess(board: readonly LetterCell[], rng: () => number = Math.random): string {
  const original = board.map((c) => c.original).join("");
  const letters = board.map((c) => c.current);
  const movable = board.filter((c) => !c.isFixed).map((c) => c.index);

  if (movable.length >= 2) {
    const a = movable[Math.floor(rng() * movable.length)];
    const others = movable.filter((i) => i !== a && letters[i] !== letters[a]);
    if (others.length > 0) {
      const b = others[Math.floor(rng() * others.length)];
      [letters[a], letters[b]] = [letters[b], letters[a]];
    }
  }

  const guess = letters.join("");
  if (guess.toLowerCase() !== original.toLowerCase()) return guess;

  // Landed on the solution by chance — nudge one letter so the guess stays wrong.
  const target = movable.length > 0 ? movable[0] : 0;
  const replacement = letters[target] === "x" ? "q" : "x";
  letters[target] = replacement;
  return letters.join("");
}

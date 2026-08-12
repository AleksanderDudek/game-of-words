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

import type { BotDifficulty, LetterCell } from "../../shared/types";

export interface BotProfile {
  /** Chance to solve on a single guess before board modifiers */
  readonly baseAccuracy: number;
  /** Chance to spend points on revealing a pair when it can afford to */
  readonly hintChance: number;
  /** Thinking pause before answering, in milliseconds */
  readonly minThinkMs: number;
  readonly maxThinkMs: number;
}

const PROFILES: Record<Exclude<BotDifficulty, "adaptive">, BotProfile> = {
  easy:   { baseAccuracy: 0.16, hintChance: 0.05, minThinkMs: 4200, maxThinkMs: 7000 },
  normal: { baseAccuracy: 0.32, hintChance: 0.15, minThinkMs: 3000, maxThinkMs: 5500 },
  hard:   { baseAccuracy: 0.55, hintChance: 0.28, minThinkMs: 1800, maxThinkMs: 3400 },
};

const ADAPTIVE_PROFILE: BotProfile = {
  baseAccuracy: 0.30,
  hintChance: 0.18,
  minThinkMs: 2400,
  maxThinkMs: 5000,
};

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

/** How long the bot pauses before answering, so its turn feels deliberate. */
export function botThinkDelayMs(difficulty: BotDifficulty, rng: () => number = Math.random): number {
  const { minThinkMs, maxThinkMs } = botProfile(difficulty);
  return Math.round(minThinkMs + rng() * (maxThinkMs - minThinkMs));
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

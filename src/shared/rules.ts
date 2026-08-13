// ═══════════════════════════════════════════════════════════════
// Custom lobby rules — bounds, sanitizing and duration bands
// ═══════════════════════════════════════════════════════════════
//
// Every field of CustomRules is optional and every one of them is an
// *override*. An empty rules object means "play exactly as the server was
// configured", which is why leaving the lobby untouched preserves the
// original behaviour byte for byte.
//
// Shared between client and server on purpose: the host's panel clamps
// with the same numbers the server enforces, so the UI never shows a value
// the session would silently reject.

import type { CustomRules, GameMode } from "./types";

// ─── Bounds ───

export interface RuleBound {
  readonly min: number;
  readonly max: number;
}

/** Inclusive limits for every numeric rule a host may override. */
export const RULE_BOUNDS = {
  /** Words (= rounds) played before the game ends. */
  wordGoal: { min: 1, max: 500 },
  /** Seconds on the clock for a single word. */
  roundSeconds: { min: 10, max: 300 },
  /** Guesses per turn (classic/team/solo) or the shared-pool base (coop). */
  guessesPerTurn: { min: 1, max: 10 },
  /** Coop lives before the run ends. */
  coopLives: { min: 1, max: 10 },
} as const satisfies Record<string, RuleBound>;

export type NumericRuleKey = keyof typeof RULE_BOUNDS;

const NUMERIC_RULE_KEYS = Object.keys(RULE_BOUNDS) as NumericRuleKey[];

/** Round and clamp a single rule into its legal range. */
export function clampRule(key: NumericRuleKey, value: number): number {
  const { min, max } = RULE_BOUNDS[key];
  return Math.max(min, Math.min(max, Math.round(value)));
}

// ─── Duration bands ───

export type DurationBandId = "5-15" | "10-20" | "20-30" | "30-45" | "45-60";

export interface DurationBand {
  readonly id: DurationBandId;
  readonly minMinutes: number;
  readonly maxMinutes: number;
}

/** The session lengths a host can aim for, shortest first. */
export const DURATION_BANDS: readonly DurationBand[] = [
  { id: "5-15", minMinutes: 5, maxMinutes: 15 },
  { id: "10-20", minMinutes: 10, maxMinutes: 20 },
  { id: "20-30", minMinutes: 20, maxMinutes: 30 },
  { id: "30-45", minMinutes: 30, maxMinutes: 45 },
  { id: "45-60", minMinutes: 45, maxMinutes: 60 },
] as const;

export function bandById(id: string | undefined): DurationBand | undefined {
  return DURATION_BANDS.find((b) => b.id === id);
}

export function isDurationBandId(value: unknown): value is DurationBandId {
  return typeof value === "string" && DURATION_BANDS.some((b) => b.id === value);
}

// ─── Sanitizing ───

/**
 * Coerce anything arriving over the wire into a safe CustomRules object.
 * Unknown keys are dropped, non-finite numbers are ignored (rather than
 * clamped to a bound, which would invent a value the host never chose) and
 * every surviving number is clamped.
 */
export function sanitizeRules(input: unknown): CustomRules {
  if (typeof input !== "object" || input === null) return {};
  const raw = input as Record<string, unknown>;
  const out: CustomRules = {};

  for (const key of NUMERIC_RULE_KEYS) {
    const value = raw[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    out[key] = clampRule(key, value);
  }

  if (isDurationBandId(raw.targetBand)) out.targetBand = raw.targetBand;

  return out;
}

/** True when the host has not overridden anything. */
export function rulesAreDefault(rules: CustomRules): boolean {
  return Object.values(rules).every((v) => v === undefined);
}

// ─── Effective values ───

/** The server-configured values a rule falls back to when left unset. */
export interface RuleDefaults {
  roundSeconds: number;
  guessesPerTurn: number;
  coopLives: number;
  /** Rounds the difficulty ramp yields when no word goal is set. */
  rampWords: number;
}

export interface EffectiveRules {
  roundSeconds: number;
  guessesPerTurn: number;
  coopLives: number;
  /** Words the run will play through — the goal, or the ramp length. */
  words: number;
  /** True when the host pinned the length instead of riding the ramp. */
  wordGoalSet: boolean;
}

/** Resolve a rules patch against the server defaults. */
export function effectiveRules(rules: CustomRules, defaults: RuleDefaults): EffectiveRules {
  return {
    roundSeconds: rules.roundSeconds ?? defaults.roundSeconds,
    guessesPerTurn: rules.guessesPerTurn ?? defaults.guessesPerTurn,
    coopLives: rules.coopLives ?? defaults.coopLives,
    words: rules.wordGoal ?? defaults.rampWords,
    wordGoalSet: rules.wordGoal !== undefined,
  };
}

/**
 * How many rounds the difficulty ramp produces: every length from min to max
 * is played WORDS_PER_DIFFICULTY times before the run ends.
 */
export function rampWordCount(
  minWordLength: number,
  maxWordLength: number,
  wordsPerDifficulty: number,
): number {
  const steps = Math.max(0, maxWordLength - minWordLength + 1);
  return steps * Math.max(1, wordsPerDifficulty);
}

/** Modes where a shared pool, not a per-player turn count, spends the guesses. */
export function guessesAreShared(mode: GameMode): boolean {
  return mode === "coop";
}

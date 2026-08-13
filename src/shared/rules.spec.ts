import { describe, it, expect } from "vitest";
import {
  RULE_BOUNDS,
  DURATION_BANDS,
  bandById,
  clampRule,
  sanitizeRules,
  rulesAreDefault,
  effectiveRules,
  rampWordCount,
} from "./rules";

describe("clampRule", () => {
  it("pins a value inside its bound", () => {
    expect(clampRule("roundSeconds", 5)).toBe(RULE_BOUNDS.roundSeconds.min);
    expect(clampRule("roundSeconds", 9999)).toBe(RULE_BOUNDS.roundSeconds.max);
    expect(clampRule("roundSeconds", 60)).toBe(60);
  });

  it("rounds fractional input", () => {
    expect(clampRule("wordGoal", 12.6)).toBe(13);
  });
});

describe("sanitizeRules", () => {
  it("returns an empty object for anything that is not a rules patch", () => {
    expect(sanitizeRules(null)).toEqual({});
    expect(sanitizeRules("30")).toEqual({});
    expect(sanitizeRules(42)).toEqual({});
  });

  it("keeps and clamps known numeric rules", () => {
    expect(sanitizeRules({ roundSeconds: 900, guessesPerTurn: 4 })).toEqual({
      roundSeconds: RULE_BOUNDS.roundSeconds.max,
      guessesPerTurn: 4,
    });
  });

  it("drops unknown keys and non-finite numbers", () => {
    expect(sanitizeRules({ nonsense: 1, roundSeconds: Number.NaN, coopLives: Infinity })).toEqual({});
  });

  it("ignores a value that is not a number at all", () => {
    expect(sanitizeRules({ wordGoal: "20" })).toEqual({});
  });

  it("keeps a recognised duration band and drops an invented one", () => {
    expect(sanitizeRules({ targetBand: "20-30" })).toEqual({ targetBand: "20-30" });
    expect(sanitizeRules({ targetBand: "99-100" })).toEqual({});
  });
});

describe("rulesAreDefault", () => {
  it("is true for an untouched lobby", () => {
    expect(rulesAreDefault({})).toBe(true);
    expect(rulesAreDefault({ roundSeconds: undefined })).toBe(true);
  });

  it("is false once anything is overridden", () => {
    expect(rulesAreDefault({ wordGoal: 10 })).toBe(false);
  });
});

describe("effectiveRules", () => {
  const defaults = { roundSeconds: 45, guessesPerTurn: 3, coopLives: 3, rampWords: 34 };

  it("falls back to the server config when nothing is overridden", () => {
    expect(effectiveRules({}, defaults)).toEqual({
      roundSeconds: 45,
      guessesPerTurn: 3,
      coopLives: 3,
      words: 34,
      wordGoalSet: false,
    });
  });

  it("prefers the host's overrides", () => {
    const resolved = effectiveRules({ roundSeconds: 90, wordGoal: 12 }, defaults);
    expect(resolved.roundSeconds).toBe(90);
    expect(resolved.words).toBe(12);
    expect(resolved.wordGoalSet).toBe(true);
    expect(resolved.guessesPerTurn).toBe(3);
  });
});

describe("rampWordCount", () => {
  it("counts every length played WORDS_PER_DIFFICULTY times", () => {
    expect(rampWordCount(4, 20, 2)).toBe(34);
    expect(rampWordCount(4, 4, 1)).toBe(1);
  });

  it("never returns a negative count for an inverted range", () => {
    expect(rampWordCount(20, 4, 2)).toBe(0);
  });
});

describe("DURATION_BANDS", () => {
  it("offers the five host-facing lengths, shortest first", () => {
    expect(DURATION_BANDS.map((b) => b.id)).toEqual(["5-15", "10-20", "20-30", "30-45", "45-60"]);
  });

  it("looks a band up by id", () => {
    expect(bandById("20-30")).toEqual({ id: "20-30", minMinutes: 20, maxMinutes: 30 });
    expect(bandById("nope")).toBeUndefined();
    expect(bandById(undefined)).toBeUndefined();
  });
});

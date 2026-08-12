import { describe, it, expect } from "vitest";
import {
  botProfile,
  botBaseAccuracy,
  botSolveProbability,
  botThinkDelayMs,
  shouldBotBuyHint,
  makeDecoyGuess,
} from "./bot";
import { buildBoard } from "../../shared/board";
import type { BotSolveInput } from "./bot";

const baseInput: BotSolveInput = {
  difficulty: "normal",
  wordLength: 5,
  minWordLength: 4,
  remainingPairs: 1,
  playerScore: 0,
  botScore: 0,
};

describe("botProfile", () => {
  it("gets sharper and faster as difficulty rises", () => {
    expect(botProfile("easy").baseAccuracy).toBeLessThan(botProfile("normal").baseAccuracy);
    expect(botProfile("normal").baseAccuracy).toBeLessThan(botProfile("hard").baseAccuracy);
    expect(botProfile("hard").maxThinkMs).toBeLessThan(botProfile("easy").minThinkMs);
  });
});

describe("botBaseAccuracy", () => {
  it("is constant for the fixed difficulties", () => {
    const trailing = { ...baseInput, difficulty: "hard" as const, playerScore: 5000 };
    expect(botBaseAccuracy(trailing)).toBe(botProfile("hard").baseAccuracy);
  });

  it("rubber-bands upward when the player pulls ahead", () => {
    const level = botBaseAccuracy({ ...baseInput, difficulty: "adaptive" });
    const behind = botBaseAccuracy({
      ...baseInput,
      difficulty: "adaptive",
      playerScore: 800,
      botScore: 0,
    });
    expect(behind).toBeGreaterThan(level);
  });

  it("eases off when the bot is ahead, and stays inside its bounds", () => {
    const ahead = botBaseAccuracy({
      ...baseInput,
      difficulty: "adaptive",
      playerScore: 0,
      botScore: 9000,
    });
    const miles = botBaseAccuracy({
      ...baseInput,
      difficulty: "adaptive",
      playerScore: 90000,
      botScore: 0,
    });
    expect(ahead).toBeGreaterThanOrEqual(0.12);
    expect(miles).toBeLessThanOrEqual(0.68);
  });
});

describe("botSolveProbability", () => {
  it("drops as the word gets longer", () => {
    const short = botSolveProbability({ ...baseInput, wordLength: 5 });
    const long = botSolveProbability({ ...baseInput, wordLength: 15 });
    expect(long).toBeLessThan(short);
  });

  it("rises as pairs get revealed", () => {
    const messy = botSolveProbability({ ...baseInput, remainingPairs: 6 });
    const clean = botSolveProbability({ ...baseInput, remainingPairs: 0 });
    expect(clean).toBeGreaterThan(messy);
  });

  it("stays a probability for every difficulty and board", () => {
    for (const difficulty of ["easy", "normal", "hard", "adaptive"] as const) {
      for (const wordLength of [4, 12, 20]) {
        const p = botSolveProbability({ ...baseInput, difficulty, wordLength, remainingPairs: 9 });
        expect(p).toBeGreaterThanOrEqual(0.03);
        expect(p).toBeLessThanOrEqual(0.92);
      }
    }
  });
});

describe("botThinkDelayMs", () => {
  it("stays inside the profile's window", () => {
    const profile = botProfile("normal");
    expect(botThinkDelayMs("normal", () => 0)).toBe(profile.minThinkMs);
    expect(botThinkDelayMs("normal", () => 1)).toBe(profile.maxThinkMs);
  });
});

describe("shouldBotBuyHint", () => {
  const affordable = { difficulty: "hard" as const, botScore: 100, hintCost: 30, remainingPairs: 4 };

  it("never buys what it cannot afford", () => {
    expect(shouldBotBuyHint({ ...affordable, botScore: 10 }, () => 0)).toBe(false);
  });

  it("does not waste points on an almost-clean board", () => {
    expect(shouldBotBuyHint({ ...affordable, remainingPairs: 1 }, () => 0)).toBe(false);
  });

  it("buys when the roll lands under its profile's appetite", () => {
    expect(shouldBotBuyHint(affordable, () => 0)).toBe(true);
    expect(shouldBotBuyHint(affordable, () => 0.99)).toBe(false);
  });
});

describe("makeDecoyGuess", () => {
  it("returns a same-length guess that is never the solution", () => {
    for (const word of ["blaze", "network", "caterpillar", "keyboard"]) {
      const board = buildBoard(word);
      for (let i = 0; i < 40; i++) {
        const decoy = makeDecoyGuess(board);
        expect(decoy).toHaveLength(word.length);
        expect(decoy.toLowerCase()).not.toBe(word);
      }
    }
  });

  it("does not mutate the board it reads", () => {
    const board = buildBoard("network");
    const before = board.map((c) => c.current).join("");
    makeDecoyGuess(board);
    expect(board.map((c) => c.current).join("")).toBe(before);
  });

  it("still produces a wrong guess on a board with nothing to swap", () => {
    const board = buildBoard("ab");
    expect(makeDecoyGuess(board).toLowerCase()).not.toBe("ab");
  });
});

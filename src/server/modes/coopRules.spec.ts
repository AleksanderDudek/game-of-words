import { describe, it, expect } from "vitest";
import { coopGuessPool, coopGrade, coopRunFailed } from "./coopRules";

describe("coopGuessPool", () => {
  it("scales the shared pool with the table size", () => {
    expect(coopGuessPool(2, 3)).toBe(5);
    expect(coopGuessPool(4, 3)).toBe(7);
  });

  it("never drops below two guesses", () => {
    expect(coopGuessPool(0, 0)).toBe(2);
    expect(coopGuessPool(-5, 1)).toBe(2);
  });
});

describe("coopGrade", () => {
  it("awards S only for a long, near-perfect run", () => {
    expect(coopGrade(10, 1)).toBe("S");
    expect(coopGrade(5, 0)).toBe("A"); // perfect but too short for S
  });

  it("ranks by solve rate", () => {
    expect(coopGrade(8, 2)).toBe("A");
    expect(coopGrade(6, 4)).toBe("B");
    expect(coopGrade(4, 6)).toBe("C");
    expect(coopGrade(2, 8)).toBe("D");
  });

  it("grades an empty run as D rather than dividing by zero", () => {
    expect(coopGrade(0, 0)).toBe("D");
  });
});

describe("coopRunFailed", () => {
  it("ends the run once the lives are gone", () => {
    expect(coopRunFailed(1)).toBe(false);
    expect(coopRunFailed(0)).toBe(true);
    expect(coopRunFailed(-1)).toBe(true);
  });
});

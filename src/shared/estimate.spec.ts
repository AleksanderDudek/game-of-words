import { describe, it, expect } from "vitest";
import { estimateDuration, fitBand, wordsForBand, formatDuration, INTER_ROUND_SEC } from "./estimate";
import { bandById } from "./rules";

const band = (id: string) => bandById(id)!;

describe("estimateDuration", () => {
  it("orders the three paces low ≤ expected ≤ high", () => {
    const est = estimateDuration({ words: 20, roundSeconds: 45, mode: "classic" });
    expect(est.lowSec).toBeLessThan(est.expectedSec);
    expect(est.expectedSec).toBeLessThan(est.highSec);
  });

  it("caps the slow pace at the full clock plus the between-rounds pause", () => {
    const est = estimateDuration({ words: 10, roundSeconds: 45, mode: "classic" });
    expect(est.highSec).toBe(10 * (45 + INTER_ROUND_SEC));
  });

  it("scales linearly with the word count", () => {
    const ten = estimateDuration({ words: 10, roundSeconds: 45, mode: "classic" });
    const twenty = estimateDuration({ words: 20, roundSeconds: 45, mode: "classic" });
    expect(twenty.expectedSec).toBe(ten.expectedSec * 2);
  });

  it("adds the lobby countdown exactly once", () => {
    const without = estimateDuration({ words: 10, roundSeconds: 45, mode: "classic" });
    const with5 = estimateDuration({ words: 10, roundSeconds: 45, mode: "classic", countdownSeconds: 5 });
    expect(with5.expectedSec - without.expectedSec).toBe(5);
  });

  it("charges team mode for the steal windows a classic game never opens", () => {
    const classic = estimateDuration({ words: 10, roundSeconds: 45, mode: "classic", stealSeconds: 15 });
    const team = estimateDuration({ words: 10, roundSeconds: 45, mode: "team", stealSeconds: 15 });
    expect(team.expectedSec).toBeGreaterThan(classic.expectedSec);
    expect(team.lowSec).toBe(classic.lowSec); // a clean attack never opens one
  });

  it("returns zero for an empty run", () => {
    expect(estimateDuration({ words: 0, roundSeconds: 45, mode: "classic" })).toEqual({
      lowSec: 0,
      expectedSec: 0,
      highSec: 0,
    });
  });
});

describe("fitBand", () => {
  it("reports a selection that lands inside the target", () => {
    const est = { lowSec: 0, expectedSec: 25 * 60, highSec: 0 };
    expect(fitBand(est, band("20-30"))).toBe("fits");
  });

  it("reports a selection that is too short", () => {
    const est = { lowSec: 0, expectedSec: 8 * 60, highSec: 0 };
    expect(fitBand(est, band("20-30"))).toBe("under");
  });

  it("reports a selection that overruns", () => {
    const est = { lowSec: 0, expectedSec: 50 * 60, highSec: 0 };
    expect(fitBand(est, band("20-30"))).toBe("over");
  });

  it("treats the band edges as inside it", () => {
    expect(fitBand({ lowSec: 0, expectedSec: 20 * 60, highSec: 0 }, band("20-30"))).toBe("fits");
    expect(fitBand({ lowSec: 0, expectedSec: 30 * 60, highSec: 0 }, band("20-30"))).toBe("fits");
  });
});

describe("wordsForBand", () => {
  it("suggests a count whose estimate lands inside the band it was asked for", () => {
    for (const id of ["5-15", "10-20", "20-30", "30-45", "45-60"]) {
      const input = { roundSeconds: 45, mode: "classic" as const, countdownSeconds: 5 };
      const words = wordsForBand(band(id), input);
      expect(fitBand(estimateDuration({ ...input, words }), band(id))).toBe("fits");
    }
  });

  it("asks for fewer words when each round is given more time", () => {
    const short = wordsForBand(band("20-30"), { roundSeconds: 30, mode: "classic" });
    const long = wordsForBand(band("20-30"), { roundSeconds: 120, mode: "classic" });
    expect(long).toBeLessThan(short);
  });

  it("never suggests a run with no words in it", () => {
    expect(wordsForBand(band("5-15"), { roundSeconds: 300, mode: "classic" })).toBeGreaterThanOrEqual(1);
  });
});

describe("formatDuration", () => {
  it("renders minutes below an hour", () => {
    expect(formatDuration(25 * 60)).toBe("25 min");
    expect(formatDuration(0)).toBe("0 min");
  });

  it("renders hours and padded minutes above one", () => {
    expect(formatDuration(65 * 60)).toBe("1h 05m");
    expect(formatDuration(120 * 60)).toBe("2h 00m");
  });
});

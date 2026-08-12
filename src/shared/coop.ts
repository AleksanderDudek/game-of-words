// ═══════════════════════════════════════════════════════════════
// Coop scoring helpers shared by server rules and result screens
// ═══════════════════════════════════════════════════════════════

export type CoopGrade = "S" | "A" | "B" | "C" | "D";

/**
 * Rank a finished co-op run by solve rate and volume. Clearing nearly
 * everything at length earns S; more misses than solves lands at D.
 * Co-op games reward a performance rather than crowning a winner.
 */
export function coopGrade(roundsCleared: number, roundsFailed: number): CoopGrade {
  const total = roundsCleared + roundsFailed;
  if (total === 0) return "D";
  const rate = roundsCleared / total;
  if (rate >= 0.9 && roundsCleared >= 8) return "S";
  if (rate >= 0.75) return "A";
  if (rate >= 0.55) return "B";
  if (rate >= 0.35) return "C";
  return "D";
}

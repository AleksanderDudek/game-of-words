// ═══════════════════════════════════════════════════════════════
// Team Mode Rules — two squads, alternating attacks, steal window
// ═══════════════════════════════════════════════════════════════
//
// Round shape (one word per round):
//
//   ATTACK   the owning squad shares a pool of guesses. Every wrong guess
//            consumes one and hands the mic to the next teammate, so the
//            whole squad stays involved instead of one player monologuing.
//   STEAL    if the pool empties, the opposing squad gets a single, shorter
//            window to answer for reduced points. This is the classic
//            game-show pressure valve — it keeps the idle team watching the
//            board instead of tuning out.
//
// Ownership alternates every round, so a steal never costs a team its turn.

import type { Player, PlayerId, TeamId } from "../../shared/types";
import { TEAM_IDS } from "../../shared/types";

/** The squad that isn't this one. */
export function otherTeam(team: TeamId): TeamId {
  return team === "alpha" ? "bravo" : "alpha";
}

/** Members of a squad, in stable join order. */
export function membersOf(players: readonly Player[], team: TeamId): Player[] {
  return players.filter((p) => p.team === team);
}

/**
 * Squad a joining player should land in — always the smaller one, so lobbies
 * stay balanced without anyone having to think about it. Ties favour alpha.
 */
export function pickTeamForJoin(players: readonly Player[]): TeamId {
  const counts = TEAM_IDS.map((id) => ({ id, size: membersOf(players, id).length }));
  return counts.reduce((best, cur) => (cur.size < best.size ? cur : best)).id;
}

/**
 * Next player to hold the mic inside a squad. Falls back to the first member
 * when the current holder has left, and returns null for an empty squad.
 */
export function nextTeamMember(
  members: readonly Player[],
  currentId: PlayerId | "",
): PlayerId | null {
  if (members.length === 0) return null;
  const idx = members.findIndex((p) => p.id === currentId);
  if (idx === -1) return members[0].id;
  return members[(idx + 1) % members.length].id;
}

/** Points awarded for answering during the steal window (a fraction of the full value). */
export function stealPoints(basePoints: number, pct: number): number {
  return Math.max(1, Math.round((basePoints * pct) / 100));
}

/** Both squads need at least one member before a team game can start. */
export function teamsAreReady(players: readonly Player[]): boolean {
  return TEAM_IDS.every((id) => membersOf(players, id).length > 0);
}

/** Winning squad, or null when the scores are level. */
export function leadingTeam(scores: Readonly<Record<TeamId, number>>): TeamId | null {
  if (scores.alpha === scores.bravo) return null;
  return scores.alpha > scores.bravo ? "alpha" : "bravo";
}

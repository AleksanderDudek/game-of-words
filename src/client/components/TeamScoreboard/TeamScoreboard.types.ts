import type { Player, RoundPhase, TeamId, TeamState } from "@/shared/types";

export interface TeamScoreboardProps {
  teams: TeamState[];
  players: Player[];
  /** Squad currently holding the word */
  attackingTeam?: TeamId;
  phase?: RoundPhase;
  /** Squad the viewer belongs to, highlighted */
  myTeam?: TeamId;
}

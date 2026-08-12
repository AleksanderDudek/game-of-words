import type { Player, TeamId } from "@/shared/types";

export interface TeamPanelProps {
  players: Player[];
  playerId: string | null;
  hostId?: string;
  onSelectTeam: (team: TeamId) => void;
}

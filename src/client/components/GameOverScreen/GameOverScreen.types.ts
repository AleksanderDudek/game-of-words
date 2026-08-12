import type { CoopState, GameMode, Player, TeamState } from "@/shared/types";

export interface GameOverScreenProps {
  players: Player[];
  playerId: string | null;
  onNewGame: () => void;
  mode?: GameMode;
  teams?: TeamState[];
  coop?: CoopState;
}

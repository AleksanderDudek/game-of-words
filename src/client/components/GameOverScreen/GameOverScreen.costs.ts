import type { Player } from "@/shared/types";

export interface GameOverScreenProps {
  players: Player[];
  playerId: string | null;
  onNewGame: () => void;
}

import type { Player } from "@/shared/types";

export interface PlayerCardProps {
  player: Player;
  isCurrent: boolean;
  isYou: boolean;
}

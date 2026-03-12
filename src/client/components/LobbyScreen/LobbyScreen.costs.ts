import type { SessionSnapshot } from "@/shared/types";

export interface LobbyScreenProps {
  session: SessionSnapshot;
  playerId: string | null;
  onStartGame: () => void;
}

import type { GameMode } from "@/shared/types";

export interface JoinScreenProps {
  connected: boolean;
  nameInput: string;
  sessionIdInput: string;
  mode: GameMode;
  onModeChange: (mode: GameMode) => void;
  onNameChange: (value: string) => void;
  onSessionIdChange: (value: string) => void;
  onJoin: () => void;
  onOpenMyPacks: () => void;
}

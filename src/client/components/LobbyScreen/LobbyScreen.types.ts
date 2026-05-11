import type { SessionSnapshot, PackReference, BuiltinPackInfo } from "@/shared/types";
import type { WordPack } from "@/client/lib/wordPack";

export interface LobbyScreenProps {
  session: SessionSnapshot;
  playerId: string | null;
  builtinPacks: BuiltinPackInfo[];
  localPacks: WordPack[];
  onStartGame: () => void;
  onSetPack: (ref: PackReference) => void;
  onSetMaxPlayers: (count: number) => void;
  onOpenMyPacks: () => void;
}

import type {
  SessionSnapshot,
  PackReference,
  BuiltinPackInfo,
  GameMode,
  TeamId,
  BotDifficulty,
} from "@/shared/types";
import type { WordPack } from "@/client/lib/wordPack";

export interface LobbyScreenProps {
  session: SessionSnapshot;
  playerId: string | null;
  builtinPacks: BuiltinPackInfo[];
  localPacks: WordPack[];
  onStartGame: () => void;
  onSetPack: (ref: PackReference) => void;
  onOpenMyPacks: () => void;
  onSetMode: (mode: GameMode) => void;
  onSetTeam: (team: TeamId) => void;
  onSetBotDifficulty: (difficulty: BotDifficulty) => void;
}

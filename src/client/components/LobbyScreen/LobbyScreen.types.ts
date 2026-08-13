import type {
  SessionSnapshot,
  PackReference,
  BuiltinPackInfo,
  CustomRules,
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
  /** Replace the whole pack selection (host, lobby only). */
  onSetPacks: (refs: PackReference[]) => void;
  /** Push custom rules; null hands the room back to the server defaults. */
  onSetRules: (rules: CustomRules | null) => void;
  onOpenMyPacks: () => void;
  onSetMode: (mode: GameMode) => void;
  onSetTeam: (team: TeamId) => void;
  onSetBotDifficulty: (difficulty: BotDifficulty) => void;
}

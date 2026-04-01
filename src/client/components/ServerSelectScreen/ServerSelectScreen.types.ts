import type { GameServerEntry, ServerInfo } from "@/shared/types";

export interface ServerSelectScreenProps {
  servers: GameServerEntry[];
  onSelect: (server: GameServerEntry) => void;
}

export interface ServerStatus {
  info: ServerInfo | null;
  latency: number | null;
  error: boolean;
}

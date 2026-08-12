import type { BotDifficulty, GameMode, TeamId } from "@/shared/types";

/** Presentation metadata for a game mode — labels themselves live in i18n. */
export interface ModeMeta {
  id: GameMode;
  icon: string;
  /** i18n key suffix under `modes.<id>` */
  minPlayers: number;
}

export const MODE_META: readonly ModeMeta[] = [
  { id: "classic", icon: "⚡", minPlayers: 2 },
  { id: "team", icon: "🛡", minPlayers: 2 },
  { id: "coop", icon: "🤝", minPlayers: 2 },
  { id: "solo", icon: "🤖", minPlayers: 1 },
] as const;

export function modeMeta(mode: GameMode): ModeMeta {
  return MODE_META.find((m) => m.id === mode) ?? MODE_META[0];
}

export const TEAM_ACCENT: Record<TeamId, string> = {
  alpha: "var(--blue)",
  bravo: "var(--orange)",
};

export const BOT_DIFFICULTY_ORDER: readonly BotDifficulty[] = [
  "easy",
  "normal",
  "hard",
  "adaptive",
] as const;

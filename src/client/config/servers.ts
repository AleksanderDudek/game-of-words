import type { GameServerEntry } from "@/shared/types";

/**
 * Default game server list for multi-region deployment.
 *
 * In production (Fly.io), each server runs independently in its region.
 * Override at build time via VITE_SERVERS (JSON array of GameServerEntry[]).
 *
 * When VITE_WS_URL is set (e.g., Docker Compose single-server mode),
 * server selection is skipped entirely.
 */
const DEFAULT_SERVERS: GameServerEntry[] = [
  {
    id: "render",
    name: "Signal Decay",
    region: "Oregon",
    url: "wss://signal-decay.onrender.com",
    flag: "🌐",
  },
];

function parseServers(): GameServerEntry[] {
  const raw = import.meta.env.VITE_SERVERS;
  if (!raw) return DEFAULT_SERVERS;
  try {
    return JSON.parse(raw) as GameServerEntry[];
  } catch {
    console.warn("[Config] Failed to parse VITE_SERVERS, using defaults");
    return DEFAULT_SERVERS;
  }
}

/** Single WS URL (Docker Compose / dev mode) — bypasses server selection */
export const SINGLE_SERVER_URL: string | undefined = import.meta.env.VITE_WS_URL;

/** Available game servers for the server-selection screen */
export const GAME_SERVERS: GameServerEntry[] = parseServers();

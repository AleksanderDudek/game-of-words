// ═══════════════════════════════════════════════════════════════
// SIGNAL DECAY — Game Configuration
// ═══════════════════════════════════════════════════════════════

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  return v ? parseInt(v, 10) : fallback;
}

function envStr(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const CONFIG = {
  // ─── Server ───
  WS_PORT:                 envInt("WS_PORT", 8080),
  MAX_CONCURRENT_SESSIONS: envInt("MAX_CONCURRENT_SESSIONS", 10),

  // ─── Region (multi-server deployment) ───
  REGION:                  envStr("REGION", "local"),
  SERVER_NAME:             envStr("SERVER_NAME", "Local Dev"),

  // ─── Word Difficulty Progression ───
  MIN_WORD_LENGTH:         envInt("MIN_WORD_LENGTH", 4),
  MAX_WORD_LENGTH:         envInt("MAX_WORD_LENGTH", 20),
  WORDS_PER_DIFFICULTY:    envInt("WORDS_PER_DIFFICULTY", 2),

  // ─── Scoring ───
  POINTS_PER_CORRECT:      envInt("POINTS_PER_CORRECT", 100),
  HINT_COST_POINTS:        envInt("HINT_COST_POINTS", 30),

  // ─── Turns ───
  TURNS_PER_PLAYER:        envInt("TURNS_PER_PLAYER", 3),

  // ─── Timing ───
  SESSION_DURATION_SEC:    envInt("SESSION_DURATION_SEC", 45),
  LOBBY_COUNTDOWN_SEC:     envInt("LOBBY_COUNTDOWN_SEC", 5),

  // ─── Players ───
  MIN_PLAYERS:             envInt("MIN_PLAYERS", 2),
  MAX_PLAYERS:             envInt("MAX_PLAYERS", 4),

  // ─── Team Mode ───
  STEAL_SECONDS:           envInt("STEAL_SECONDS", 15),   // steal window after a failed attack
  STEAL_POINTS_PCT:        envInt("STEAL_POINTS_PCT", 60), // % of round points awarded on a steal

  // ─── Coop Mode ───
  COOP_LIVES:              envInt("COOP_LIVES", 3),
  COOP_GUESSES_BASE:       envInt("COOP_GUESSES_BASE", 3), // shared pool = base + player count

  // ─── Solo Mode ───
  BOT_NAME:                envStr("BOT_NAME", "CIPHER"),
  // Wall-clock ceiling for a whole bot turn, not a single guess — the rival
  // shares the round clock with the player, so its thinking is capped.
  BOT_TURN_BUDGET_MS:      envInt("BOT_TURN_BUDGET_MS", 2000),

  // ─── LLM Endpoint (pluggable) ───
  LLM_ENDPOINT:            envStr("LLM_ENDPOINT", ""),
  LLM_API_KEY:             envStr("LLM_API_KEY", ""),
  LLM_TIMEOUT_MS:          envInt("LLM_TIMEOUT_MS", 5000),

  // ─── Production Security ───
  ALLOWED_ORIGINS:         envStr("ALLOWED_ORIGINS", ""),   // comma-separated, empty = allow all
  RATE_LIMIT_MSG_PER_SEC:  envInt("RATE_LIMIT_MSG_PER_SEC", 15),
  MAX_NAME_LENGTH:         envInt("MAX_NAME_LENGTH", 20),
  MAX_GUESS_LENGTH:        envInt("MAX_GUESS_LENGTH", 50),
} as const;

export type ServerConfig = typeof CONFIG;

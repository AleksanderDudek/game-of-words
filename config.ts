// ═══════════════════════════════════════════════════════════════
// SIGNAL DECAY — Game Configuration
// All tunable game parameters live here.
// Values can be overridden via environment variables.
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

  // ─── LLM Endpoint (pluggable) ───
  // POST { prompt, minLength, maxLength } → { word, hint }
  // Leave empty to use built-in fallback word bank.
  LLM_ENDPOINT:            envStr("LLM_ENDPOINT", ""),
  LLM_API_KEY:             envStr("LLM_API_KEY", ""),
  LLM_TIMEOUT_MS:          envInt("LLM_TIMEOUT_MS", 5000),
};

export type GameConfig = typeof CONFIG;

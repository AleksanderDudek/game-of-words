// ═══════════════════════════════════════════════════════════════
// Shared types — used by both server and client
// ═══════════════════════════════════════════════════════════════

// ─── Utility Types ───

/** Brand a primitive type to create nominal typing (prevents mixing structurally identical values) */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** Deep-readonly mapped type — recursively makes all properties immutable */
export type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends Record<string, unknown>
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

/** Make only the selected keys required while keeping the rest unchanged */
export type RequireKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/** Extract a single member from a discriminated union by its type discriminant */
export type MessageOfType<
  T extends string,
  U extends { type: string },
> = Extract<U, { type: T }>;

/** Exhaustive-check helper for switch/if chains over discriminated unions */
export function assertNever(value: never): never {
  throw new Error(`Unhandled discriminated union member: ${JSON.stringify(value)}`);
}

// ─── Branded Identifiers ───

/** Nominal type for player identifiers — prevents accidental mixing with other string IDs */
export type PlayerId = Brand<string, "PlayerId">;

/** Nominal type for session identifiers */
export type SessionId = Brand<string, "SessionId">;

/** Cast a raw string to a PlayerId at trust boundaries (ID creation / deserialization) */
export function toPlayerId(raw: string): PlayerId {
  return raw as PlayerId;
}

/** Cast a raw string to a SessionId at trust boundaries */
export function toSessionId(raw: string): SessionId {
  return raw as SessionId;
}

// ─── Word Pack Types (protocol-level) ───

export interface WordPackEntry {
  word: string;
  hint: string;
}

export type PackReference =
  | { type: "builtin"; packId: string }
  | { type: "custom"; name: string; words: WordPackEntry[] }
  | { type: "clear" };

export interface BuiltinPackInfo {
  id: string;
  name: string;
  description: string;
  wordCount: number;
}

/** A pack currently selected for the run, as summarised back to clients. */
export interface ActivePackInfo {
  /** Stable key for the selection: "builtin:<id>" or "custom:<name>". */
  key: string;
  name: string;
  wordCount: number;
}

// ─── Custom Lobby Rules ───

/**
 * Host overrides applied at the lobby. Every field is optional and every
 * field is an override — an empty object means "play the server defaults",
 * which is exactly what an untouched lobby sends.
 *
 * See ./rules.ts for the bounds and the resolution helpers.
 */
export interface CustomRules {
  /** Words (= rounds) to play before the game ends. Unset = difficulty ramp. */
  wordGoal?: number;
  /** Seconds on the clock per word. */
  roundSeconds?: number;
  /** Guesses per turn; in coop this is the shared-pool base instead. */
  guessesPerTurn?: number;
  /** Coop lives before the run ends. */
  coopLives?: number;
  /** The length the host is aiming for — drives the lobby's fit feedback. */
  targetBand?: string;
}

// ─── Game States ───
export type SessionState = "lobby" | "countdown" | "playing" | "paused" | "round_end" | "game_over";

// ─── Game Modes ───

/**
 * classic — free-for-all, everyone for themselves (original rules)
 * team    — two squads alternate attacking a word; a failed attack opens a steal
 * coop    — everyone versus the word list, sharing one guess pool, bank and lives
 * solo    — one human against a heuristic bot rival
 */
export type GameMode = "classic" | "team" | "coop" | "solo";

export const GAME_MODES: readonly GameMode[] = ["classic", "team", "coop", "solo"] as const;

export type TeamId = "alpha" | "bravo";

export const TEAM_IDS: readonly TeamId[] = ["alpha", "bravo"] as const;

/** Bot skill for solo mode. "adaptive" rubber-bands toward the player's score. */
export type BotDifficulty = "easy" | "normal" | "hard" | "adaptive";

export const BOT_DIFFICULTIES: readonly BotDifficulty[] = ["easy", "normal", "hard", "adaptive"] as const;

/** Team mode round phase: the owning squad attacks first, opponents may steal after a failed attack. */
export type RoundPhase = "attack" | "steal";

export interface TeamState {
  id: TeamId;
  score: number;
  /** Rounds this team has solved (attack or steal) */
  solved: number;
}

export interface CoopState {
  /** Shared point bank — solves add to it, hints are paid from it */
  bank: number;
  livesLeft: number;
  maxLives: number;
  /** Shared guesses remaining on the current word */
  guessesLeft: number;
  guessesPerRound: number;
  roundsCleared: number;
  roundsFailed: number;
}

// ─── Player ───
export interface Player {
  id: PlayerId;
  name: string;
  score: number;
  isConnected: boolean;
  isSpectator?: boolean;  // joined mid-game; becomes active at next round start
  team?: TeamId;          // team mode only
  isBot?: boolean;        // solo mode rival
}

// ─── A single letter cell on the board ───
export interface LetterCell {
  index: number;          // position in the word
  original: string;       // correct character
  current: string;        // currently displayed character
  isFixed: boolean;       // true for first char, last char, special chars
  isRevealed: boolean;    // true if player paid to uncover this
  swappedWith: number | null; // index of the letter this was swapped with
}

// ─── Game Configuration (immutable snapshot sent to clients) ───
export interface GameConfig {
  readonly pointsPerCorrect: number;
  readonly hintCostPoints: number;
  /** Effective value — reflects the host's override when one is set. */
  readonly turnsPerPlayer: number;
  /** Effective value — reflects the host's override when one is set. */
  readonly sessionDurationSec: number;
  readonly minWordLength: number;
  readonly maxWordLength: number;
  readonly minPlayers?: number;
  readonly maxPlayers?: number;
  // ─── Mode-specific (always sent so lobbies can preview the rules) ───
  /** Effective value — reflects the host's override when one is set. */
  readonly coopLives?: number;
  readonly stealSeconds?: number;
  readonly stealPointsPct?: number;
  // ─── Length (lets the lobby estimate how long a run will take) ───
  /** Words played per difficulty step when riding the ramp. */
  readonly wordsPerDifficulty?: number;
  /** Countdown paid once between "start" and the first word. */
  readonly lobbyCountdownSec?: number;
  /** Words this run will play — the host's goal, or the ramp length. */
  readonly wordCount?: number;
}

// ─── Round state ───
export interface RoundState {
  roundNumber: number;
  board: LetterCell[];
  hint: string;
  difficulty: number;
  timeLeft: number;
  currentPlayerId: PlayerId;
  turnsRemaining: number;
  wordLength: number;
  /** team mode — which squad currently holds the word, and whether this is the steal window */
  attackingTeam?: TeamId;
  phase?: RoundPhase;
  /** solo mode — true while the bot is "thinking" before it answers */
  botThinking?: boolean;
}

// ─── Session (full game state sent to clients) ───
export interface SessionSnapshot {
  sessionId: SessionId;
  hostId?: PlayerId;        // playerId of the session host
  state: SessionState;
  mode: GameMode;
  players: Player[];
  round: RoundState | null;
  config: GameConfig;
  playerLimit: number;      // current per-session max players (host-configurable)
  countdownLeft?: number;
  /** Combined summary of the selection — a single pack, or all of them merged. */
  activePack?: { name: string; wordCount: number };
  /** Every pack the host has selected. Empty/absent = the default word bank. */
  activePacks?: ActivePackInfo[];
  /** Host rule overrides. Absent or empty = the server defaults are in play. */
  rules?: CustomRules;
  teams?: TeamState[];      // team mode
  coop?: CoopState;         // coop mode
  botDifficulty?: BotDifficulty; // solo mode
}

// ═══════════════════════════════════════════════════════════════
// WebSocket Message Protocol
// ═══════════════════════════════════════════════════════════════

// ─── Client → Server ───
export type ClientMessage =
  | { type: "join"; name: string; sessionId?: string; playerId?: string; mode?: GameMode } // playerId = rejoin, mode = preferred lobby
  | { type: "start_game" }
  | { type: "guess"; word: string }
  | { type: "buy_hint" }
  | { type: "pass_turn" }       // current player voluntarily skips their turn
  | { type: "pause_game" }      // pause the timer
  | { type: "resume_game" }     // resume after pause
  | { type: "forfeit_game" }    // leave the game permanently
  | { type: "set_word_pack"; pack: PackReference }
  | { type: "set_word_packs"; packs: PackReference[] } // host replaces the whole selection (lobby only)
  | { type: "set_rules"; rules: CustomRules | null }   // host tunes length/time/guesses; null resets (lobby only)
  | { type: "set_max_players"; count: number }  // host changes max players (lobby only)
  | { type: "set_mode"; mode: GameMode }        // host changes game mode (lobby only)
  | { type: "set_team"; team: TeamId }          // player picks a squad (team mode, lobby only)
  | { type: "set_bot_difficulty"; difficulty: BotDifficulty } // solo mode (lobby only)
  | { type: "ping" };

// ─── Server → Client ───
export type ServerMessage =
  | { type: "session_update"; session: SessionSnapshot }
  | { type: "joined"; playerId: string; sessionId: string }
  | { type: "guess_result"; correct: boolean; guess: string; playerId: string }
  | { type: "hint_revealed"; index1: number; index2: number; playerId: string }
  | { type: "round_won"; playerId: string; word: string; points: number }
  | { type: "turn_switched"; newPlayerId: string; turnsRemaining: number }
  | { type: "player_joined"; playerId: string; playerName: string; isSpectator: boolean }
  | { type: "player_left"; playerId: string; playerName: string }
  | { type: "game_paused"; byPlayerId: string }
  | { type: "game_resumed"; byPlayerId: string }
  | { type: "steal_phase"; team: TeamId; seconds: number }   // team mode: attack failed, opponents get one shot
  | { type: "life_lost"; livesLeft: number; word: string }    // coop mode: word not solved
  | { type: "error"; message: string }
  | { type: "pong" };

// ─── Message Protocol Mapping (conditional type) ───

/** Maps each client message type to its expected server response type */
export type ExpectedResponse<T extends ClientMessage["type"]> =
  T extends "join" ? MessageOfType<"joined", ServerMessage> :
  T extends "guess" ? MessageOfType<"guess_result", ServerMessage> :
  T extends "buy_hint" ? MessageOfType<"hint_revealed", ServerMessage> :
  T extends "start_game" ? MessageOfType<"session_update", ServerMessage> :
  T extends "pass_turn" ? MessageOfType<"turn_switched", ServerMessage> :
  T extends "pause_game" ? MessageOfType<"game_paused", ServerMessage> :
  T extends "resume_game" ? MessageOfType<"game_resumed", ServerMessage> :
  T extends "ping" ? MessageOfType<"pong", ServerMessage> :
  T extends "forfeit_game" ? MessageOfType<"player_left", ServerMessage> :
  ServerMessage;

// ─── Type Guards ───

const CLIENT_MESSAGE_TYPES: ReadonlySet<string> = new Set<ClientMessage["type"]>([
  "join", "start_game", "guess", "buy_hint", "pass_turn",
  "pause_game", "resume_game", "forfeit_game", "set_word_pack", "set_word_packs",
  "set_rules", "set_max_players", "set_mode", "set_team", "set_bot_difficulty", "ping",
]);

/** Runtime narrowing for mode values arriving over the wire */
export function isGameMode(value: unknown): value is GameMode {
  return typeof value === "string" && (GAME_MODES as readonly string[]).includes(value);
}

/** Runtime narrowing for team values arriving over the wire */
export function isTeamId(value: unknown): value is TeamId {
  return typeof value === "string" && (TEAM_IDS as readonly string[]).includes(value);
}

/** Runtime narrowing for bot difficulty values arriving over the wire */
export function isBotDifficulty(value: unknown): value is BotDifficulty {
  return typeof value === "string" && (BOT_DIFFICULTIES as readonly string[]).includes(value);
}

/** Runtime type guard for validating incoming client messages */
export function isClientMessage(msg: unknown): msg is ClientMessage {
  if (typeof msg !== "object" || msg === null || !("type" in msg)) return false;
  return CLIENT_MESSAGE_TYPES.has((msg as { type: string }).type);
}

// ─── Server Info (REST API) ───

export interface ServerInfo {
  region: string;
  name: string;
  activeSessions: number;
  totalPlayers: number;
  maxSessions: number;
}

/** Configuration for a game server endpoint (used by server selection UI) */
export interface GameServerEntry {
  id: string;
  name: string;
  region: string;
  url: string;
  flag: string;
}

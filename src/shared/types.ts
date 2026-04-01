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

// ─── Game States ───
export type SessionState = "lobby" | "countdown" | "playing" | "paused" | "round_end" | "game_over";

// ─── Player ───
export interface Player {
  id: PlayerId;
  name: string;
  score: number;
  isConnected: boolean;
  isSpectator?: boolean;  // joined mid-game; becomes active at next round start
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
  readonly turnsPerPlayer: number;
  readonly sessionDurationSec: number;
  readonly minWordLength: number;
  readonly maxWordLength: number;
  readonly minPlayers?: number;
  readonly maxPlayers?: number;
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
}

// ─── Session (full game state sent to clients) ───
export interface SessionSnapshot {
  sessionId: SessionId;
  hostId?: PlayerId;        // playerId of the session host
  state: SessionState;
  players: Player[];
  round: RoundState | null;
  config: GameConfig;
  countdownLeft?: number;
}

// ═══════════════════════════════════════════════════════════════
// WebSocket Message Protocol
// ═══════════════════════════════════════════════════════════════

// ─── Client → Server ───
export type ClientMessage =
  | { type: "join"; name: string; sessionId?: string; playerId?: string } // playerId = rejoin
  | { type: "start_game" }
  | { type: "guess"; word: string }
  | { type: "buy_hint" }
  | { type: "pass_turn" }       // current player voluntarily skips their turn
  | { type: "pause_game" }      // pause the timer
  | { type: "resume_game" }     // resume after pause
  | { type: "forfeit_game" }    // leave the game permanently
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
  "pause_game", "resume_game", "forfeit_game", "ping",
]);

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

// ═══════════════════════════════════════════════════════════════
// Shared types — used by both server and client
// ═══════════════════════════════════════════════════════════════

// ─── Game States ───
export type SessionState = "lobby" | "countdown" | "playing" | "round_end" | "game_over";

// ─── Player ───
export interface Player {
  id: string;
  name: string;
  score: number;
  isConnected: boolean;
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

// ─── Round state ───
export interface RoundState {
  roundNumber: number;
  board: LetterCell[];
  hint: string;
  difficulty: number;     // current word length target
  timeLeft: number;
  currentPlayerId: string;
  turnsRemaining: number; // guesses left for current player
  wordLength: number;
}

// ─── Session (full game state sent to clients) ───
export interface SessionSnapshot {
  sessionId: string;
  state: SessionState;
  players: Player[];
  round: RoundState | null;
  config: {
    pointsPerCorrect: number;
    hintCostPoints: number;
    turnsPerPlayer: number;
    sessionDurationSec: number;
    minWordLength: number;
    maxWordLength: number;
  };
  countdownLeft?: number;
}

// ═══════════════════════════════════════════════════════════════
// WebSocket Message Protocol
// ═══════════════════════════════════════════════════════════════

// ─── Client → Server ───
export type ClientMessage =
  | { type: "join"; name: string; sessionId?: string }
  | { type: "start_game" }
  | { type: "guess"; word: string }
  | { type: "buy_hint" }
  | { type: "ping" };

// ─── Server → Client ───
export type ServerMessage =
  | { type: "session_update"; session: SessionSnapshot }
  | { type: "joined"; playerId: string; sessionId: string }
  | { type: "guess_result"; correct: boolean; guess: string; playerId: string }
  | { type: "hint_revealed"; index1: number; index2: number; playerId: string }
  | { type: "round_won"; playerId: string; word: string; points: number }
  | { type: "turn_switched"; newPlayerId: string; turnsRemaining: number }
  | { type: "error"; message: string }
  | { type: "pong" };

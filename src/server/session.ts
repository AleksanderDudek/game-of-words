// ═══════════════════════════════════════════════════════════════
// Game Session — Manages a single game room
// ═══════════════════════════════════════════════════════════════

import { v4 as uuid } from "uuid";
import WebSocket from "ws";
import { CONFIG } from "./config";
import {
  Player,
  PlayerId,
  SessionId,
  SessionState,
  SessionSnapshot,
  RoundState,
  LetterCell,
  GameConfig,
  ServerMessage,
  ClientMessage,
  toPlayerId,
  toSessionId,
  assertNever,
} from "../shared/types";
import { buildBoard, revealNextPair, checkGuess, boardToString, remainingPairs } from "../shared/board";
import { generateWord, getBuiltinPackWords, BUILTIN_PACKS, GeneratedWord } from "./wordgen";
import type { PackReference } from "../shared/types";

interface ConnectedPlayer extends Player {
  ws: WebSocket;
}

export class GameSession {
  id: SessionId;
  hostId: PlayerId = "" as PlayerId;
  state: SessionState = "lobby";
  players: Map<PlayerId, ConnectedPlayer> = new Map();
  board: LetterCell[] = [];
  hint: string = "";
  originalWord: string = "";
  roundNumber: number = 0;
  currentPlayerId: PlayerId = "" as PlayerId;
  turnsRemaining: number = CONFIG.TURNS_PER_PLAYER;
  timeLeft: number = CONFIG.SESSION_DURATION_SEC;
  timerInterval: ReturnType<typeof setInterval> | null = null;
  countdownLeft: number = 0;
  currentDifficulty: number = CONFIG.MIN_WORD_LENGTH;
  wordsAtCurrentDifficulty: number = 0;
  pendingPack: { name: string; words: GeneratedWord[] } | null = null;
  packQueue: GeneratedWord[] = [];
  packQueueIndex: number = 0;

  constructor() {
    this.id = toSessionId(uuid().slice(0, 8));
  }

  // ─── Player Management ───

  // Returns new playerId (fresh join) or existing playerId (rejoin).
  addPlayer(ws: WebSocket, name: string, existingPlayerId?: string): PlayerId | "" {
    // ── Rejoin path: player reconnects with stored credentials ──
    if (existingPlayerId) {
      const existing = this.players.get(toPlayerId(existingPlayerId));
      if (existing) {
        existing.ws = ws;
        existing.isConnected = true;
        existing.name = name;
        this.sendTo(ws, { type: "joined", playerId: existing.id, sessionId: this.id });
        this.broadcastState();
        console.log(`[Session ${this.id}] Player "${name}" (${existing.id}) rejoined.`);
        return existing.id;
      }
      // Stored ID not found — fall through to a fresh join
    }

    // ── Full-session guard (count only connected slots) ──
    const connectedCount = [...this.players.values()].filter((p) => p.isConnected).length;
    if (connectedCount >= CONFIG.MAX_PLAYERS) {
      this.sendTo(ws, { type: "error", message: "Session is full" });
      return "";
    }

    const playerId = toPlayerId(uuid().slice(0, 8));
    const isSpectator = this.state !== "lobby"; // joining mid-game → spectator until next round
    const player: ConnectedPlayer = {
      id: playerId,
      name,
      score: 0,
      isConnected: true,
      isSpectator,
      ws,
    };
    this.players.set(playerId, player);

    if (!this.hostId) this.hostId = playerId; // first player is host
    this.sendTo(ws, { type: "joined", playerId, sessionId: this.id });
    this.broadcast({ type: "player_joined", playerId, playerName: name, isSpectator });
    this.broadcastState();
    console.log(`[Session ${this.id}] Player "${name}" (${playerId}) joined as ${isSpectator ? "spectator" : "player"}. Total: ${this.players.size}`);
    return playerId;
  }

  removePlayer(playerId: PlayerId): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.isConnected = false;
    console.log(`[Session ${this.id}] Player "${player.name}" disconnected`);
    this.broadcast({ type: "player_left", playerId, playerName: player.name });

    // Pass host to the next connected player if needed
    if (this.hostId === playerId) {
      const next = [...this.players.values()].find((p) => p.isConnected && p.id !== playerId);
      this.hostId = next?.id ?? ("" as PlayerId);
    }

    const connected = [...this.players.values()].filter((p) => p.isConnected);
    if (connected.length === 0) {
      this.cleanup();
      return;
    }

    // If the disconnected player held the turn, advance it
    if ((this.state === "playing" || this.state === "paused") && this.currentPlayerId === playerId) {
      this.advanceTurn();
    }

    this.broadcastState();
  }

  // ─── Game Flow ───

  async startGame(): Promise<void> {
    if (this.state !== "lobby") return;

    const readyCount = [...this.players.values()].filter((p) => p.isConnected && !p.isSpectator).length;
    if (readyCount < CONFIG.MIN_PLAYERS) {
      this.broadcast({ type: "error", message: `Need at least ${CONFIG.MIN_PLAYERS} players` });
      return;
    }

    // Countdown
    this.state = "countdown";
    this.countdownLeft = CONFIG.LOBBY_COUNTDOWN_SEC;
    this.broadcastState();

    for (let i = CONFIG.LOBBY_COUNTDOWN_SEC; i > 0; i--) {
      this.countdownLeft = i;
      this.broadcastState();
      await this.sleep(1000);
    }

    this.state = "playing";
    this.currentDifficulty = CONFIG.MIN_WORD_LENGTH;
    this.wordsAtCurrentDifficulty = 0;
    this.roundNumber = 0;
    // Snapshot pending pack into a shuffled queue for this game run
    if (this.pendingPack) {
      this.packQueue = [...this.pendingPack.words].sort(() => Math.random() - 0.5);
      this.packQueueIndex = 0;
    } else {
      this.packQueue = [];
    }
    const active = this.getActivePlayers();
    this.currentPlayerId = active[0].id;
    await this.startNewRound();
  }

  async startNewRound(): Promise<void> {
    // Promote any spectators who joined mid-game into the active rotation
    for (const player of this.players.values()) {
      if (player.isSpectator && player.isConnected) {
        player.isSpectator = false;
        console.log(`[Session ${this.id}] Spectator "${player.name}" is now an active player.`);
      }
    }

    this.roundNumber++;
    this.turnsRemaining = CONFIG.TURNS_PER_PLAYER;
    this.timeLeft = CONFIG.SESSION_DURATION_SEC;

    // Draw from pack queue if active, otherwise generate
    let word: string;
    let hint: string;
    if (this.packQueue.length > 0) {
      if (this.packQueueIndex >= this.packQueue.length) {
        // Re-shuffle and cycle
        this.packQueue.sort(() => Math.random() - 0.5);
        this.packQueueIndex = 0;
      }
      const entry = this.packQueue[this.packQueueIndex++];
      word = entry.word;
      hint = entry.hint;
    } else {
      ({ word, hint } = await generateWord(this.currentDifficulty));
    }
    this.originalWord = word;
    this.hint = hint;
    this.board = buildBoard(word);

    console.log(
      `[Session ${this.id}] Round ${this.roundNumber}: "${word}" (${word.length} chars) → "${boardToString(this.board)}"`
    );

    // Start timer
    this.startTimer();
    this.broadcastState();
  }

  startTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.handleTimeUp();
      }
      // Broadcast every second for timer updates
      this.broadcastState();
    }, 1000);
  }

  handleTimeUp(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = null;

    // Nobody guessed — reveal the word and move on
    this.state = "round_end";
    this.broadcast({
      type: "round_won",
      playerId: "",
      word: this.originalWord,
      points: 0,
    });
    this.broadcastState();

    // Next round after brief pause — next player's word
    setTimeout(async () => {
      this.progressDifficulty();
      if (this.currentDifficulty > CONFIG.MAX_WORD_LENGTH) {
        this.endGame();
      } else {
        this.rotatePlayer();
        this.state = "playing";
        await this.startNewRound();
      }
    }, 3000);
  }

  // ─── Player Actions ───

  handleGuess(playerId: PlayerId, guess: string): void {
    if (this.state !== "playing") return;
    if (this.currentPlayerId !== playerId) {
      const player = this.players.get(playerId);
      if (player) this.sendTo(player.ws, { type: "error", message: "Not your turn" });
      return;
    }

    const correct = checkGuess(this.board, guess);
    this.broadcast({ type: "guess_result", correct, guess, playerId });

    if (correct) {
      // Score!
      const player = this.players.get(playerId)!;
      const timeBonus = Math.floor(this.timeLeft / 5);
      const pairsBonus = remainingPairs(this.board) * 10;
      const totalPoints = CONFIG.POINTS_PER_CORRECT + timeBonus + pairsBonus;
      player.score += totalPoints;

      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerInterval = null;

      this.broadcast({
        type: "round_won",
        playerId,
        word: this.originalWord,
        points: totalPoints,
      });

      this.state = "round_end";
      this.broadcastState();

      // Next round after brief celebration — next player's word
      setTimeout(async () => {
        this.progressDifficulty();
        if (this.currentDifficulty > CONFIG.MAX_WORD_LENGTH) {
          this.endGame();
        } else {
          this.rotatePlayer();
          this.state = "playing";
          await this.startNewRound();
        }
      }, 3000);
    } else {
      // Wrong guess — consume a turn
      this.turnsRemaining--;
      if (this.turnsRemaining <= 0) {
        this.advanceTurn();
      }
      this.broadcastState();
    }
  }

  handleBuyHint(playerId: PlayerId): void {
    if (this.state !== "playing") return;
    const player = this.players.get(playerId);
    if (!player) return;

    if (player.score < CONFIG.HINT_COST_POINTS) {
      this.sendTo(player.ws, {
        type: "error",
        message: `Need ${CONFIG.HINT_COST_POINTS} points (you have ${player.score})`,
      });
      return;
    }

    const pair = revealNextPair(this.board);
    if (!pair) {
      this.sendTo(player.ws, { type: "error", message: "No more pairs to reveal" });
      return;
    }

    player.score -= CONFIG.HINT_COST_POINTS;
    this.broadcast({
      type: "hint_revealed",
      index1: pair[0],
      index2: pair[1],
      playerId,
    });
    this.broadcastState();
  }

  // ─── Turn Management ───

  // Called mid-round when the active player exhausts their guesses (or passes).
  // Switches to the next player on the SAME word and notifies clients.
  advanceTurn(): void {
    const active = this.getActivePlayers();
    if (active.length === 0) return;

    const idx = active.findIndex((p) => p.id === this.currentPlayerId);
    const next = active[(idx + 1) % active.length];
    this.currentPlayerId = next.id;
    this.turnsRemaining = CONFIG.TURNS_PER_PLAYER;

    this.broadcast({
      type: "turn_switched",
      newPlayerId: next.id,
      turnsRemaining: this.turnsRemaining,
    });
    this.broadcastState();
  }

  // Called between rounds to silently advance to the next player.
  private rotatePlayer(): void {
    const active = this.getActivePlayers();
    if (active.length === 0) return;
    const idx = active.findIndex((p) => p.id === this.currentPlayerId);
    this.currentPlayerId = active[(idx + 1) % active.length].id;
  }

  getActivePlayers(): ConnectedPlayer[] {
    return [...this.players.values()].filter((p) => p.isConnected && !p.isSpectator);
  }

  // ─── Voluntary Actions ───

  handlePassTurn(playerId: PlayerId): void {
    if (this.state !== "playing") return;
    if (this.currentPlayerId !== playerId) {
      const player = this.players.get(playerId);
      if (player) this.sendTo(player.ws, { type: "error", message: "Not your turn" });
      return;
    }
    console.log(`[Session ${this.id}] Player "${playerId}" passed their turn.`);
    this.advanceTurn();
  }

  handlePauseGame(playerId: PlayerId): void {
    if (this.state !== "playing") return;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.state = "paused";
    this.broadcast({ type: "game_paused", byPlayerId: playerId });
    this.broadcastState();
    console.log(`[Session ${this.id}] Game paused by "${playerId}".`);
  }

  handleResumeGame(playerId: PlayerId): void {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.startTimer();
    this.broadcast({ type: "game_resumed", byPlayerId: playerId });
    this.broadcastState();
    console.log(`[Session ${this.id}] Game resumed by "${playerId}".`);
  }

  handleForfeitGame(playerId: PlayerId): void {
    const player = this.players.get(playerId);
    if (!player) return;

    console.log(`[Session ${this.id}] Player "${player.name}" forfeited.`);
    player.isConnected = false;
    this.broadcast({ type: "player_left", playerId, playerName: player.name });

    if (this.hostId === playerId) {
      const next = [...this.players.values()].find((p) => p.isConnected && p.id !== playerId);
      this.hostId = next?.id ?? ("" as PlayerId);
    }

    const stillActive = this.getActivePlayers();
    if (stillActive.length === 0) {
      this.cleanup();
      return;
    }

    if (
      stillActive.length < CONFIG.MIN_PLAYERS &&
      this.state !== "lobby" &&
      this.state !== "game_over"
    ) {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerInterval = null;
      this.endGame();
      return;
    }

    if (this.currentPlayerId === playerId && (this.state === "playing" || this.state === "paused")) {
      this.advanceTurn();
    }

    this.broadcastState();
  }

  // ─── Difficulty Progression ───

  progressDifficulty(): void {
    this.wordsAtCurrentDifficulty++;
    if (this.wordsAtCurrentDifficulty >= CONFIG.WORDS_PER_DIFFICULTY) {
      this.currentDifficulty++;
      this.wordsAtCurrentDifficulty = 0;
      console.log(`[Session ${this.id}] Difficulty up → ${this.currentDifficulty} letters`);
    }
  }

  // ─── End Game ───

  endGame(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.state = "game_over";
    this.broadcastState();
    console.log(`[Session ${this.id}] Game over!`);
  }

  cleanup(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = null;
    console.log(`[Session ${this.id}] Cleaned up`);
  }

  // ─── Message handling ───

  handleMessage(playerId: PlayerId, msg: ClientMessage): void {
    switch (msg.type) {
      case "start_game":   this.startGame(); break;
      case "guess":        this.handleGuess(playerId, msg.word); break;
      case "buy_hint":     this.handleBuyHint(playerId); break;
      case "pass_turn":    this.handlePassTurn(playerId); break;
      case "pause_game":   this.handlePauseGame(playerId); break;
      case "resume_game":  this.handleResumeGame(playerId); break;
      case "forfeit_game": this.handleForfeitGame(playerId); break;
      case "set_word_pack": this.handleSetWordPack(playerId, msg.pack); break;
      case "ping": {
        const player = this.players.get(playerId);
        if (player) this.sendTo(player.ws, { type: "pong" });
        break;
      }
      case "join":
        // join is handled at the server level, not session level
        break;
      default:
        assertNever(msg);
    }
  }

  // ─── Networking ───

  getSnapshot(): SessionSnapshot {
    const round: RoundState | null =
      this.state === "playing" || this.state === "round_end" || this.state === "paused"
        ? {
            roundNumber: this.roundNumber,
            board: this.board.map((c) => ({
              ...c,
              // Don't leak the original to clients unless revealed/fixed
              original: c.isFixed || c.isRevealed ? c.original : "?",
            })),
            hint: this.hint,
            difficulty: this.currentDifficulty,
            timeLeft: this.timeLeft,
            currentPlayerId: this.currentPlayerId,
            turnsRemaining: this.turnsRemaining,
            wordLength: this.originalWord.length,
          }
        : null;

    const config: GameConfig = {
      pointsPerCorrect: CONFIG.POINTS_PER_CORRECT,
      hintCostPoints: CONFIG.HINT_COST_POINTS,
      turnsPerPlayer: CONFIG.TURNS_PER_PLAYER,
      sessionDurationSec: CONFIG.SESSION_DURATION_SEC,
      minWordLength: CONFIG.MIN_WORD_LENGTH,
      maxWordLength: CONFIG.MAX_WORD_LENGTH,
      minPlayers: CONFIG.MIN_PLAYERS,
      maxPlayers: CONFIG.MAX_PLAYERS,
    };

    return {
      sessionId: this.id,
      hostId: this.hostId,
      state: this.state,
      players: [...this.players.values()].map(({ ws: _ws, ...rest }) => rest),
      round,
      config,
      countdownLeft: this.countdownLeft,
      activePack: this.pendingPack
        ? { name: this.pendingPack.name, wordCount: this.pendingPack.words.length }
        : undefined,
    };
  }

  // ─── Pack Selection ───

  handleSetWordPack(playerId: PlayerId, pack: PackReference): void {
    if (this.state !== "lobby") {
      const player = this.players.get(playerId);
      if (player) this.sendTo(player.ws, { type: "error", message: "Cannot change pack after game starts" });
      return;
    }
    if (this.hostId !== playerId) {
      const player = this.players.get(playerId);
      if (player) this.sendTo(player.ws, { type: "error", message: "Only the host can set the word pack" });
      return;
    }

    if (pack.type === "clear") {
      this.pendingPack = null;
      this.broadcastState();
      return;
    }

    if (pack.type === "builtin") {
      if (!/^[a-z0-9-]+$/.test(pack.packId)) {
        const player = this.players.get(playerId);
        if (player) this.sendTo(player.ws, { type: "error", message: "Invalid pack ID" });
        return;
      }
      const words = getBuiltinPackWords(pack.packId);
      if (!words) {
        const player = this.players.get(playerId);
        if (player) this.sendTo(player.ws, { type: "error", message: "Unknown built-in pack" });
        return;
      }
      this.pendingPack = { name: BUILTIN_PACKS[pack.packId]!.name, words };
      this.broadcastState();
      return;
    }

    // Custom pack — validate and sanitize
    if (typeof pack.name !== "string" || pack.name.trim().length === 0 || pack.name.length > 50) {
      const player = this.players.get(playerId);
      if (player) this.sendTo(player.ws, { type: "error", message: "Invalid pack name" });
      return;
    }
    if (!Array.isArray(pack.words) || pack.words.length === 0 || pack.words.length > 500) {
      const player = this.players.get(playerId);
      if (player) this.sendTo(player.ws, { type: "error", message: "Pack must have 1–500 words" });
      return;
    }

    const validWord = /^[a-z][a-z' -]*[a-z]$|^[a-z]$/;
    const words: GeneratedWord[] = [];
    for (const entry of pack.words) {
      if (typeof entry.word !== "string" || typeof entry.hint !== "string") continue;
      const word = entry.word.toLowerCase().replace(/[^\x20-\x7e]/g, "").trim();
      const hint = entry.hint.replace(/[^\x20-\x7e]/g, "").trim();
      if (word.length < 2 || word.length > 50) continue;
      if (hint.length === 0 || hint.length > 200) continue;
      if (!validWord.test(word)) continue;
      words.push({ word, hint });
    }

    if (words.length === 0) {
      const player = this.players.get(playerId);
      if (player) this.sendTo(player.ws, { type: "error", message: "No valid words in pack" });
      return;
    }

    this.pendingPack = { name: pack.name.trim(), words };
    this.broadcastState();
  }

  broadcastState(): void {
    this.broadcast({ type: "session_update", session: this.getSnapshot() });
  }

  broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const player of this.players.values()) {
      if (player.isConnected && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(data);
      }
    }
  }

  sendTo(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

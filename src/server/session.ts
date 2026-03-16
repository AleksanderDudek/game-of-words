// ═══════════════════════════════════════════════════════════════
// Game Session — Manages a single game room
// ═══════════════════════════════════════════════════════════════

import { v4 as uuid } from "uuid";
import WebSocket from "ws";
import { CONFIG } from "./config";
import {
  Player,
  SessionState,
  SessionSnapshot,
  RoundState,
  LetterCell,
  ServerMessage,
  ClientMessage,
} from "../shared/types";
import { buildBoard, revealNextPair, checkGuess, boardToString, remainingPairs } from "../shared/board";
import { generateWord } from "./wordgen";

interface ConnectedPlayer extends Player {
  ws: WebSocket;
}

export class GameSession {
  id: string;
  hostId: string = "";
  state: SessionState = "lobby";
  players: Map<string, ConnectedPlayer> = new Map();
  board: LetterCell[] = [];
  hint: string = "";
  originalWord: string = "";
  roundNumber: number = 0;
  currentPlayerId: string = "";
  turnsRemaining: number = CONFIG.TURNS_PER_PLAYER;
  timeLeft: number = CONFIG.SESSION_DURATION_SEC;
  timerInterval: ReturnType<typeof setInterval> | null = null;
  countdownLeft: number = 0;
  currentDifficulty: number = CONFIG.MIN_WORD_LENGTH;
  wordsAtCurrentDifficulty: number = 0;

  constructor() {
    this.id = uuid().slice(0, 8);
  }

  // ─── Player Management ───

  // Returns new playerId (fresh join) or existing playerId (rejoin).
  addPlayer(ws: WebSocket, name: string, existingPlayerId?: string): string {
    // ── Rejoin path: player reconnects with stored credentials ──
    if (existingPlayerId) {
      const existing = this.players.get(existingPlayerId);
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

    const playerId = uuid().slice(0, 8);
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

  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.isConnected = false;
    console.log(`[Session ${this.id}] Player "${player.name}" disconnected`);
    this.broadcast({ type: "player_left", playerId, playerName: player.name });

    // Pass host to the next connected player if needed
    if (this.hostId === playerId) {
      const next = [...this.players.values()].find((p) => p.isConnected && p.id !== playerId);
      this.hostId = next?.id ?? "";
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

    // Generate word at current difficulty
    const { word, hint } = await generateWord(this.currentDifficulty);
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

  handleGuess(playerId: string, guess: string): void {
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

  handleBuyHint(playerId: string): void {
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

  handlePassTurn(playerId: string): void {
    if (this.state !== "playing") return;
    if (this.currentPlayerId !== playerId) {
      const player = this.players.get(playerId);
      if (player) this.sendTo(player.ws, { type: "error", message: "Not your turn" });
      return;
    }
    console.log(`[Session ${this.id}] Player "${playerId}" passed their turn.`);
    this.advanceTurn();
  }

  handlePauseGame(playerId: string): void {
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

  handleResumeGame(playerId: string): void {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.startTimer();
    this.broadcast({ type: "game_resumed", byPlayerId: playerId });
    this.broadcastState();
    console.log(`[Session ${this.id}] Game resumed by "${playerId}".`);
  }

  handleForfeitGame(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    console.log(`[Session ${this.id}] Player "${player.name}" forfeited.`);
    player.isConnected = false;
    this.broadcast({ type: "player_left", playerId, playerName: player.name });

    if (this.hostId === playerId) {
      const next = [...this.players.values()].find((p) => p.isConnected && p.id !== playerId);
      this.hostId = next?.id ?? "";
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

  handleMessage(playerId: string, msg: ClientMessage): void {
    switch (msg.type) {
      case "start_game":   this.startGame(); break;
      case "guess":        this.handleGuess(playerId, msg.word); break;
      case "buy_hint":     this.handleBuyHint(playerId); break;
      case "pass_turn":    this.handlePassTurn(playerId); break;
      case "pause_game":   this.handlePauseGame(playerId); break;
      case "resume_game":  this.handleResumeGame(playerId); break;
      case "forfeit_game": this.handleForfeitGame(playerId); break;
      case "ping": {
        const player = this.players.get(playerId);
        if (player) this.sendTo(player.ws, { type: "pong" });
        break;
      }
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

    return {
      sessionId: this.id,
      hostId: this.hostId,
      state: this.state,
      players: [...this.players.values()].map(({ ws, ...rest }) => rest),
      round,
      config: {
        pointsPerCorrect: CONFIG.POINTS_PER_CORRECT,
        hintCostPoints: CONFIG.HINT_COST_POINTS,
        turnsPerPlayer: CONFIG.TURNS_PER_PLAYER,
        sessionDurationSec: CONFIG.SESSION_DURATION_SEC,
        minWordLength: CONFIG.MIN_WORD_LENGTH,
        maxWordLength: CONFIG.MAX_WORD_LENGTH,
        minPlayers: CONFIG.MIN_PLAYERS,
        maxPlayers: CONFIG.MAX_PLAYERS,
      },
      countdownLeft: this.countdownLeft,
    };
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

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
} from "./types";
import { buildBoard, revealNextPair, checkGuess, boardToString, remainingPairs } from "./board";
import { generateWord } from "./wordgen";

interface ConnectedPlayer extends Player {
  ws: WebSocket;
}

export class GameSession {
  id: string;
  state: SessionState = "lobby";
  players: Map<string, ConnectedPlayer> = new Map();
  board: LetterCell[] = [];
  hint: string = "";
  originalWord: string = "";
  roundNumber: number = 0;
  currentPlayerIndex: number = 0;
  turnsRemaining: number = CONFIG.TURNS_PER_PLAYER;
  timeLeft: number = CONFIG.SESSION_DURATION_SEC;
  timerInterval: NodeJS.Timeout | null = null;
  countdownLeft: number = 0;
  currentDifficulty: number = CONFIG.MIN_WORD_LENGTH;
  wordsAtCurrentDifficulty: number = 0;

  constructor() {
    this.id = uuid().slice(0, 8);
  }

  // ─── Player Management ───

  addPlayer(ws: WebSocket, name: string): string {
    if (this.players.size >= CONFIG.MAX_PLAYERS) {
      this.sendTo(ws, { type: "error", message: "Session is full" });
      return "";
    }
    if (this.state !== "lobby") {
      this.sendTo(ws, { type: "error", message: "Game already in progress" });
      return "";
    }

    const playerId = uuid().slice(0, 8);
    const player: ConnectedPlayer = {
      id: playerId,
      name,
      score: 0,
      isConnected: true,
      ws,
    };
    this.players.set(playerId, player);

    this.sendTo(ws, { type: "joined", playerId, sessionId: this.id });
    this.broadcastState();
    console.log(`[Session ${this.id}] Player "${name}" (${playerId}) joined. Total: ${this.players.size}`);
    return playerId;
  }

  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.isConnected = false;
      console.log(`[Session ${this.id}] Player "${player.name}" disconnected`);

      // If all disconnected, clean up
      const connected = [...this.players.values()].filter((p) => p.isConnected);
      if (connected.length === 0) {
        this.cleanup();
      } else {
        // If it was current player's turn, advance
        if (this.state === "playing") {
          const orderedPlayers = this.getOrderedPlayers();
          if (
            orderedPlayers[this.currentPlayerIndex]?.id === playerId
          ) {
            this.advanceTurn();
          }
        }
        this.broadcastState();
      }
    }
  }

  // ─── Game Flow ───

  async startGame(): Promise<void> {
    if (this.state !== "lobby") return;
    const connected = [...this.players.values()].filter((p) => p.isConnected);
    if (connected.length < CONFIG.MIN_PLAYERS) {
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
    await this.startNewRound();
  }

  async startNewRound(): Promise<void> {
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

    // Nobody guessed — reveal the word and move on
    this.state = "round_end";
    this.broadcast({
      type: "round_won",
      playerId: "",
      word: this.originalWord,
      points: 0,
    });
    this.broadcastState();

    // Next round after brief pause
    setTimeout(async () => {
      this.progressDifficulty();
      if (this.currentDifficulty > CONFIG.MAX_WORD_LENGTH) {
        this.endGame();
      } else {
        this.state = "playing";
        await this.startNewRound();
      }
    }, 3000);
  }

  // ─── Player Actions ───

  handleGuess(playerId: string, guess: string): void {
    if (this.state !== "playing") return;
    const orderedPlayers = this.getOrderedPlayers();
    const currentPlayer = orderedPlayers[this.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== playerId) {
      const player = this.players.get(playerId);
      if (player) {
        this.sendTo(player.ws, { type: "error", message: "Not your turn" });
      }
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

      this.broadcast({
        type: "round_won",
        playerId,
        word: this.originalWord,
        points: totalPoints,
      });

      this.state = "round_end";
      this.broadcastState();

      // Next round after brief celebration
      setTimeout(async () => {
        this.progressDifficulty();
        if (this.currentDifficulty > CONFIG.MAX_WORD_LENGTH) {
          this.endGame();
        } else {
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

  advanceTurn(): void {
    const orderedPlayers = this.getOrderedPlayers();
    if (orderedPlayers.length === 0) return;

    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % orderedPlayers.length;
    this.turnsRemaining = CONFIG.TURNS_PER_PLAYER;

    const newPlayer = orderedPlayers[this.currentPlayerIndex];
    this.broadcast({
      type: "turn_switched",
      newPlayerId: newPlayer.id,
      turnsRemaining: this.turnsRemaining,
    });
    this.broadcastState();
  }

  getOrderedPlayers(): ConnectedPlayer[] {
    return [...this.players.values()].filter((p) => p.isConnected);
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
    this.state = "game_over";
    this.broadcastState();
    console.log(`[Session ${this.id}] Game over!`);
  }

  cleanup(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    console.log(`[Session ${this.id}] Cleaned up`);
  }

  // ─── Message handling ───

  handleMessage(playerId: string, msg: ClientMessage): void {
    switch (msg.type) {
      case "start_game":
        this.startGame();
        break;
      case "guess":
        this.handleGuess(playerId, msg.word);
        break;
      case "buy_hint":
        this.handleBuyHint(playerId);
        break;
      case "ping":
        const player = this.players.get(playerId);
        if (player) this.sendTo(player.ws, { type: "pong" });
        break;
    }
  }

  // ─── Networking ───

  getSnapshot(): SessionSnapshot {
    const orderedPlayers = this.getOrderedPlayers();
    const currentPlayer = orderedPlayers[this.currentPlayerIndex];

    const round: RoundState | null =
      this.state === "playing" || this.state === "round_end"
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
            currentPlayerId: currentPlayer?.id ?? "",
            turnsRemaining: this.turnsRemaining,
            wordLength: this.originalWord.length,
          }
        : null;

    return {
      sessionId: this.id,
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

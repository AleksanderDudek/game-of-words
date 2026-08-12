// ═══════════════════════════════════════════════════════════════
// Game Session — Manages a single game room
// ═══════════════════════════════════════════════════════════════
//
// One class drives every mode. The board, timer, word packs and difficulty
// ramp are shared; what changes per mode is who holds the mic, where points
// are banked, and what happens when a word goes unsolved.
//
//   classic  free-for-all — the original rules
//   team     two squads alternate attacking, failed attacks open a steal
//   coop     one shared guess pool, one shared bank, a stack of lives
//   solo     the human against a heuristic bot rival
//
// See ./modes/* for the per-mode rules those branches call into.

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
  RoundPhase,
  LetterCell,
  GameConfig,
  GameMode,
  TeamId,
  TeamState,
  CoopState,
  BotDifficulty,
  ServerMessage,
  ClientMessage,
  toPlayerId,
  toSessionId,
  assertNever,
} from "../shared/types";
import { buildBoard, revealNextPair, checkGuess, boardToString, remainingPairs } from "../shared/board";
import { generateWord, getBuiltinPackWords, BUILTIN_PACKS, GeneratedWord } from "./wordgen";
import type { PackReference } from "../shared/types";
import {
  otherTeam,
  membersOf,
  pickTeamForJoin,
  nextTeamMember,
  stealPoints,
  teamsAreReady,
} from "./modes/teamRules";
import { coopGuessPool } from "./modes/coopRules";
import {
  botSolveProbability,
  botThinkDelayMs,
  shouldBotBuyHint,
  makeDecoyGuess,
} from "./modes/bot";

interface ConnectedPlayer extends Player {
  /** null for the solo-mode bot, which has no socket behind it */
  ws: WebSocket | null;
}

export class GameSession {
  id: SessionId;
  hostId: PlayerId = "" as PlayerId;
  state: SessionState = "lobby";
  mode: GameMode = "classic";
  players: Map<PlayerId, ConnectedPlayer> = new Map();
  maxPlayers: number = CONFIG.MAX_PLAYERS;
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

  // ─── Team mode ───
  teamScores: Record<TeamId, number> = { alpha: 0, bravo: 0 };
  teamSolved: Record<TeamId, number> = { alpha: 0, bravo: 0 };
  attackingTeam: TeamId = "alpha";
  roundPhase: RoundPhase = "attack";
  /** Last player to hold the mic in each squad, so rotation survives phase flips */
  teamMic: Record<TeamId, PlayerId | ""> = { alpha: "", bravo: "" };

  // ─── Coop mode ───
  coopBank: number = 0;
  coopLives: number = CONFIG.COOP_LIVES;
  coopGuessesLeft: number = 0;
  coopGuessesPerRound: number = 0;
  coopCleared: number = 0;
  coopFailed: number = 0;

  // ─── Solo mode ───
  botDifficulty: BotDifficulty = "adaptive";
  botId: PlayerId | "" = "";
  botTimer: ReturnType<typeof setTimeout> | null = null;
  botThinking: boolean = false;

  constructor(mode: GameMode = "classic") {
    this.id = toSessionId(uuid().slice(0, 8));
    this.applyMode(mode);
  }

  // ─── Mode Setup ───

  /** Reset all mode-scoped state and re-seat players for the new mode. */
  private applyMode(mode: GameMode): void {
    this.mode = mode;
    this.teamScores = { alpha: 0, bravo: 0 };
    this.teamSolved = { alpha: 0, bravo: 0 };
    this.teamMic = { alpha: "", bravo: "" };
    this.attackingTeam = "alpha";
    this.roundPhase = "attack";
    this.coopBank = 0;
    this.coopLives = CONFIG.COOP_LIVES;
    this.coopCleared = 0;
    this.coopFailed = 0;

    if (mode === "team") {
      // Re-balance everyone into squads from scratch
      const seated: Player[] = [];
      for (const player of this.players.values()) {
        player.team = pickTeamForJoin(seated);
        seated.push(player);
      }
    } else {
      for (const player of this.players.values()) player.team = undefined;
    }

    if (mode === "solo") {
      this.maxPlayers = 2;
      this.ensureBot();
    } else {
      this.maxPlayers = CONFIG.MAX_PLAYERS;
      this.removeBot();
    }
  }

  /** Solo mode needs a rival in the room before the game can start. */
  private ensureBot(): void {
    if (this.botId && this.players.has(this.botId)) return;
    const botId = toPlayerId(`bot-${uuid().slice(0, 4)}`);
    this.players.set(botId, {
      id: botId,
      name: CONFIG.BOT_NAME,
      score: 0,
      isConnected: true,
      isBot: true,
      ws: null,
    });
    this.botId = botId;
  }

  private removeBot(): void {
    if (this.botId) this.players.delete(this.botId);
    this.botId = "";
    this.clearBotTimer();
  }

  /** Minimum seats (bot included) before the mode can start. */
  private minPlayersForMode(): number {
    return this.mode === "solo" ? 2 : CONFIG.MIN_PLAYERS;
  }

  /** Real people currently in the room — the bot never keeps a session alive. */
  connectedHumans(): ConnectedPlayer[] {
    return [...this.players.values()].filter((p) => p.isConnected && !p.isBot);
  }

  hasConnectedHumans(): boolean {
    return this.connectedHumans().length > 0;
  }

  /** Solo rooms are private — nobody else may join them. */
  isJoinable(): boolean {
    if (this.mode === "solo") return this.connectedHumans().length === 0;
    return this.state === "lobby" && this.connectedHumans().length < this.maxPlayers;
  }

  // ─── Player Management ───

  // Returns new playerId (fresh join) or existing playerId (rejoin).
  addPlayer(ws: WebSocket, name: string, existingPlayerId?: string): PlayerId | "" {
    // ── Rejoin path: player reconnects with stored credentials ──
    if (existingPlayerId) {
      const existing = this.players.get(toPlayerId(existingPlayerId));
      if (existing && !existing.isBot) {
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

    // ── Solo rooms belong to a single human ──
    if (this.mode === "solo" && this.connectedHumans().length > 0) {
      this.sendTo(ws, { type: "error", message: "Solo sessions are private" });
      return "";
    }

    // ── Full-session guard (count only connected human slots) ──
    if (this.connectedHumans().length >= this.maxPlayers) {
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
    if (this.mode === "team") {
      player.team = pickTeamForJoin([...this.players.values()]);
    }
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
      const next = this.connectedHumans().find((p) => p.id !== playerId);
      this.hostId = next?.id ?? ("" as PlayerId);
    }

    if (!this.hasConnectedHumans()) {
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

    if (this.mode === "solo") this.ensureBot();

    const readyPlayers = this.getActivePlayers();
    if (readyPlayers.length < this.minPlayersForMode()) {
      this.broadcast({ type: "error", message: `Need at least ${this.minPlayersForMode()} players` });
      return;
    }
    if (this.mode === "team" && !teamsAreReady(readyPlayers)) {
      this.broadcast({ type: "error", message: "Both squads need at least one player" });
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
    this.resetModeScores();
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

  /** Zero the per-run scoreboards for whichever mode is about to be played. */
  private resetModeScores(): void {
    this.teamScores = { alpha: 0, bravo: 0 };
    this.teamSolved = { alpha: 0, bravo: 0 };
    this.teamMic = { alpha: "", bravo: "" };
    this.coopBank = 0;
    this.coopLives = CONFIG.COOP_LIVES;
    this.coopCleared = 0;
    this.coopFailed = 0;
    for (const player of this.players.values()) player.score = 0;
  }

  async startNewRound(): Promise<void> {
    // Promote any spectators who joined mid-game into the active rotation
    for (const player of this.players.values()) {
      if (player.isSpectator && player.isConnected) {
        player.isSpectator = false;
        if (this.mode === "team" && !player.team) {
          player.team = pickTeamForJoin([...this.players.values()].filter((p) => p.id !== player.id));
        }
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

    this.setupRoundForMode();

    console.log(
      `[Session ${this.id}] Round ${this.roundNumber} (${this.mode}): "${word}" (${word.length} chars) → "${boardToString(this.board)}"`
    );

    // Start timer
    this.startTimer();
    this.broadcastState();
    this.maybeScheduleBot();
  }

  /** Per-mode round bootstrapping: squad ownership, shared pools, mic handover. */
  private setupRoundForMode(): void {
    if (this.mode === "team") {
      // Ownership alternates every round so a steal never costs a squad its turn.
      this.attackingTeam = this.roundNumber % 2 === 1 ? "alpha" : "bravo";
      this.roundPhase = "attack";
      this.handMicToTeam(this.attackingTeam);
      return;
    }

    if (this.mode === "coop") {
      this.coopGuessesPerRound = coopGuessPool(this.getActivePlayers().length, CONFIG.COOP_GUESSES_BASE);
      this.coopGuessesLeft = this.coopGuessesPerRound;
      this.turnsRemaining = this.coopGuessesLeft;
      return;
    }

    // classic / solo already rotated between rounds
  }

  /** Give the mic to the next player in a squad's rotation. Returns false if empty. */
  private handMicToTeam(team: TeamId): boolean {
    const members = membersOf(this.getActivePlayers(), team);
    const next = nextTeamMember(members, this.teamMic[team]);
    if (!next) return false;
    this.teamMic[team] = next;
    this.currentPlayerId = next;
    return true;
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
    this.clearBotTimer();

    // Team mode: a timed-out attack still owes the other squad a steal attempt.
    if (this.mode === "team" && this.roundPhase === "attack" && this.beginStealPhase()) return;

    this.failRound();
  }

  /**
   * Nobody solved the word — reveal it, take the coop life if there is one to
   * take, and roll into the next round (or end the run).
   */
  private failRound(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.clearBotTimer();

    this.state = "round_end";

    if (this.mode === "coop") {
      this.coopFailed++;
      this.coopLives--;
      this.broadcast({ type: "life_lost", livesLeft: Math.max(0, this.coopLives), word: this.originalWord });
    }

    this.broadcast({
      type: "round_won",
      playerId: "",
      word: this.originalWord,
      points: 0,
    });
    this.broadcastState();

    this.scheduleNextRound();
  }

  /**
   * Hand the word to the opposing squad for one short, single-guess window.
   * Returns false when there is nobody to steal (then the round just fails).
   */
  private beginStealPhase(): boolean {
    const thief = otherTeam(this.attackingTeam);
    if (membersOf(this.getActivePlayers(), thief).length === 0) return false;

    this.roundPhase = "steal";
    this.attackingTeam = thief;
    this.turnsRemaining = 1;
    this.timeLeft = CONFIG.STEAL_SECONDS;
    this.handMicToTeam(thief);

    this.broadcast({ type: "steal_phase", team: thief, seconds: CONFIG.STEAL_SECONDS });
    this.startTimer();
    this.broadcastState();
    console.log(`[Session ${this.id}] Steal window opened for ${thief}.`);
    return true;
  }

  /** Shared post-round transition used by both the solved and failed paths. */
  private scheduleNextRound(): void {
    setTimeout(async () => {
      if (this.state !== "round_end") return; // session ended or was torn down

      if (this.mode === "coop" && this.coopLives <= 0) {
        this.endGame();
        return;
      }

      this.progressDifficulty();
      if (this.currentDifficulty > CONFIG.MAX_WORD_LENGTH) {
        this.endGame();
        return;
      }
      if (!this.hasConnectedHumans()) {
        this.cleanup();
        return;
      }

      this.rotatePlayer();
      this.state = "playing";
      await this.startNewRound();
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
      this.handleCorrectGuess(playerId);
      return;
    }

    this.consumeGuess();
    this.maybeScheduleBot();
  }

  private handleCorrectGuess(playerId: PlayerId): void {
    const player = this.players.get(playerId)!;
    const timeBonus = Math.floor(this.timeLeft / 5);
    const pairsBonus = remainingPairs(this.board) * 10;
    let totalPoints = CONFIG.POINTS_PER_CORRECT + timeBonus + pairsBonus;

    // A steal is worth less than a clean solve — that's the trade for a free shot.
    if (this.mode === "team" && this.roundPhase === "steal") {
      totalPoints = stealPoints(totalPoints, CONFIG.STEAL_POINTS_PCT);
    }

    this.awardPoints(player, totalPoints);

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.clearBotTimer();

    this.broadcast({
      type: "round_won",
      playerId,
      word: this.originalWord,
      points: totalPoints,
    });

    this.state = "round_end";
    this.broadcastState();
    this.scheduleNextRound();
  }

  /**
   * Credit a solve. Personal score is always tracked (it drives the MVP and
   * contribution readouts), while the *spendable* bank depends on the mode.
   */
  private awardPoints(player: ConnectedPlayer, points: number): void {
    player.score += points;
    if (this.mode === "team" && player.team) {
      this.teamScores[player.team] += points;
      this.teamSolved[player.team]++;
    }
    if (this.mode === "coop") {
      this.coopBank += points;
      this.coopCleared++;
    }
  }

  /**
   * Burn one guess from whichever pool this mode uses, then either hand the mic
   * on or close the round out.
   */
  private consumeGuess(): void {
    if (this.mode === "coop") {
      this.coopGuessesLeft--;
      this.turnsRemaining = Math.max(0, this.coopGuessesLeft);
      if (this.coopGuessesLeft <= 0) {
        this.failRound();
        return;
      }
      this.advanceTurn();
      return;
    }

    this.turnsRemaining--;

    if (this.mode === "team") {
      if (this.turnsRemaining > 0) {
        this.advanceTurn();
        return;
      }
      if (this.roundPhase === "attack") {
        if (!this.beginStealPhase()) this.failRound();
      } else {
        this.failRound();
      }
      return;
    }

    // classic / solo
    if (this.turnsRemaining <= 0) {
      this.advanceTurn();
    }
    this.broadcastState();
  }

  handleBuyHint(playerId: PlayerId): void {
    if (this.state !== "playing") return;
    const player = this.players.get(playerId);
    if (!player) return;

    if (this.mode === "team" && player.team !== this.attackingTeam) {
      this.sendTo(player.ws, { type: "error", message: "Only the squad on the clock can reveal" });
      return;
    }

    const available = this.availablePoints(player);
    if (available < CONFIG.HINT_COST_POINTS) {
      this.sendTo(player.ws, {
        type: "error",
        message: `Need ${CONFIG.HINT_COST_POINTS} points (you have ${available})`,
      });
      return;
    }

    const pair = revealNextPair(this.board);
    if (!pair) {
      this.sendTo(player.ws, { type: "error", message: "No more pairs to reveal" });
      return;
    }

    this.spendPoints(player, CONFIG.HINT_COST_POINTS);
    this.broadcast({
      type: "hint_revealed",
      index1: pair[0],
      index2: pair[1],
      playerId,
    });
    this.broadcastState();
  }

  /** Points this player can spend — personal, squad or shared depending on mode. */
  private availablePoints(player: ConnectedPlayer): number {
    if (this.mode === "team") return player.team ? this.teamScores[player.team] : 0;
    if (this.mode === "coop") return this.coopBank;
    return player.score;
  }

  private spendPoints(player: ConnectedPlayer, cost: number): void {
    if (this.mode === "team" && player.team) {
      this.teamScores[player.team] -= cost;
      return;
    }
    if (this.mode === "coop") {
      this.coopBank -= cost;
      return;
    }
    player.score -= cost;
  }

  // ─── Turn Management ───

  // Called mid-round when the active player exhausts a guess (or passes).
  // Hands the mic on within the same word and notifies clients.
  advanceTurn(): void {
    const active = this.getActivePlayers();
    if (active.length === 0) return;

    if (this.mode === "team") {
      if (!this.handMicToTeam(this.attackingTeam)) return;
    } else if (this.mode === "coop") {
      const idx = active.findIndex((p) => p.id === this.currentPlayerId);
      this.currentPlayerId = active[(idx + 1) % active.length].id;
      this.turnsRemaining = Math.max(0, this.coopGuessesLeft);
    } else {
      const idx = active.findIndex((p) => p.id === this.currentPlayerId);
      this.currentPlayerId = active[(idx + 1) % active.length].id;
      this.turnsRemaining = CONFIG.TURNS_PER_PLAYER;
    }

    this.broadcast({
      type: "turn_switched",
      newPlayerId: this.currentPlayerId,
      turnsRemaining: this.turnsRemaining,
    });
    this.broadcastState();
    this.maybeScheduleBot();
  }

  // Called between rounds to silently advance to the next player.
  private rotatePlayer(): void {
    // Team and coop pick their next speaker from the round setup instead.
    if (this.mode === "team" || this.mode === "coop") return;
    const active = this.getActivePlayers();
    if (active.length === 0) return;
    const idx = active.findIndex((p) => p.id === this.currentPlayerId);
    this.currentPlayerId = active[(idx + 1) % active.length].id;
  }

  getActivePlayers(): ConnectedPlayer[] {
    return [...this.players.values()].filter((p) => p.isConnected && !p.isSpectator);
  }

  // ─── Solo Bot ───

  private clearBotTimer(): void {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    this.botThinking = false;
  }

  /** Put the bot on the clock whenever the mic lands on it during play. */
  private maybeScheduleBot(): void {
    if (this.mode !== "solo" || !this.botId) return;
    if (this.botTimer) return; // already thinking
    if (this.state !== "playing" || this.currentPlayerId !== this.botId) return;

    this.botThinking = true;
    this.botTimer = setTimeout(() => this.performBotMove(), botThinkDelayMs(this.botDifficulty));
    this.broadcastState();
  }

  private performBotMove(): void {
    this.botTimer = null;
    this.botThinking = false;
    if (this.mode !== "solo" || this.state !== "playing") return;
    if (!this.botId || this.currentPlayerId !== this.botId) return;

    const bot = this.players.get(this.botId);
    const human = this.connectedHumans()[0];
    if (!bot) return;

    if (
      shouldBotBuyHint({
        difficulty: this.botDifficulty,
        botScore: bot.score,
        hintCost: CONFIG.HINT_COST_POINTS,
        remainingPairs: remainingPairs(this.board),
      })
    ) {
      this.handleBuyHint(this.botId);
    }

    const solveChance = botSolveProbability({
      difficulty: this.botDifficulty,
      wordLength: this.originalWord.length,
      minWordLength: CONFIG.MIN_WORD_LENGTH,
      remainingPairs: remainingPairs(this.board),
      playerScore: human?.score ?? 0,
      botScore: bot.score,
    });

    const guess = Math.random() < solveChance ? this.originalWord : makeDecoyGuess(this.board);
    this.handleGuess(this.botId, guess);
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

    // Shared-pool modes charge a guess for a pass, otherwise a squad could
    // cycle the mic forever and stall the clock for free.
    if (this.mode === "team" || this.mode === "coop") {
      this.consumeGuess();
      return;
    }
    this.advanceTurn();
  }

  handlePauseGame(playerId: PlayerId): void {
    if (this.state !== "playing") return;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.clearBotTimer();
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
    this.maybeScheduleBot();
    console.log(`[Session ${this.id}] Game resumed by "${playerId}".`);
  }

  handleForfeitGame(playerId: PlayerId): void {
    const player = this.players.get(playerId);
    if (!player) return;

    console.log(`[Session ${this.id}] Player "${player.name}" forfeited.`);
    player.isConnected = false;
    this.broadcast({ type: "player_left", playerId, playerName: player.name });

    if (this.hostId === playerId) {
      const next = this.connectedHumans().find((p) => p.id !== playerId);
      this.hostId = next?.id ?? ("" as PlayerId);
    }

    if (!this.hasConnectedHumans()) {
      this.cleanup();
      return;
    }

    const stillActive = this.getActivePlayers();
    const teamsBroken = this.mode === "team" && !teamsAreReady(stillActive);
    if (
      (stillActive.length < this.minPlayersForMode() || teamsBroken) &&
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
    this.clearBotTimer();
    this.state = "game_over";
    this.broadcastState();
    console.log(`[Session ${this.id}] Game over!`);
  }

  cleanup(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.clearBotTimer();
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
      case "set_max_players": this.handleSetMaxPlayers(playerId, msg.count); break;
      case "set_mode":     this.handleSetMode(playerId, msg.mode); break;
      case "set_team":     this.handleSetTeam(playerId, msg.team); break;
      case "set_bot_difficulty": this.handleSetBotDifficulty(playerId, msg.difficulty); break;
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
            ...(this.mode === "team"
              ? { attackingTeam: this.attackingTeam, phase: this.roundPhase }
              : {}),
            ...(this.mode === "solo" ? { botThinking: this.botThinking } : {}),
          }
        : null;

    const config: GameConfig = {
      pointsPerCorrect: CONFIG.POINTS_PER_CORRECT,
      hintCostPoints: CONFIG.HINT_COST_POINTS,
      turnsPerPlayer: CONFIG.TURNS_PER_PLAYER,
      sessionDurationSec: CONFIG.SESSION_DURATION_SEC,
      minWordLength: CONFIG.MIN_WORD_LENGTH,
      maxWordLength: CONFIG.MAX_WORD_LENGTH,
      minPlayers: this.minPlayersForMode(),
      maxPlayers: this.maxPlayers,
      coopLives: CONFIG.COOP_LIVES,
      stealSeconds: CONFIG.STEAL_SECONDS,
      stealPointsPct: CONFIG.STEAL_POINTS_PCT,
    };

    const teams: TeamState[] | undefined =
      this.mode === "team"
        ? [
            { id: "alpha", score: this.teamScores.alpha, solved: this.teamSolved.alpha },
            { id: "bravo", score: this.teamScores.bravo, solved: this.teamSolved.bravo },
          ]
        : undefined;

    const coop: CoopState | undefined =
      this.mode === "coop"
        ? {
            bank: this.coopBank,
            livesLeft: Math.max(0, this.coopLives),
            maxLives: CONFIG.COOP_LIVES,
            guessesLeft: Math.max(0, this.coopGuessesLeft),
            guessesPerRound: this.coopGuessesPerRound,
            roundsCleared: this.coopCleared,
            roundsFailed: this.coopFailed,
          }
        : undefined;

    return {
      sessionId: this.id,
      hostId: this.hostId,
      state: this.state,
      mode: this.mode,
      players: [...this.players.values()].map(({ ws: _ws, ...rest }) => rest),
      round,
      config,
      playerLimit: this.maxPlayers,
      countdownLeft: this.countdownLeft,
      activePack: this.pendingPack
        ? { name: this.pendingPack.name, wordCount: this.pendingPack.words.length }
        : undefined,
      teams,
      coop,
      botDifficulty: this.mode === "solo" ? this.botDifficulty : undefined,
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

  // ─── Max Players Configuration ───

  handleSetMaxPlayers(playerId: PlayerId, count: number): void {
    if (!this.requireLobbyHost(playerId, "Cannot change max players after game starts", "Only the host can change max players")) return;

    const clamped = Math.max(CONFIG.MIN_PLAYERS, Math.min(CONFIG.MAX_PLAYERS, Math.floor(count)));
    if (!Number.isFinite(clamped)) {
      const player = this.players.get(playerId);
      if (player) this.sendTo(player.ws, { type: "error", message: "Invalid player count" });
      return;
    }

    this.maxPlayers = clamped;
    this.broadcastState();
    console.log(`[Session ${this.id}] Max players set to ${this.maxPlayers} by host.`);
  }

  // ─── Mode Configuration ───

  handleSetMode(playerId: PlayerId, mode: GameMode): void {
    if (!this.requireLobbyHost(playerId, "Cannot change mode after game starts", "Only the host can change the mode")) return;
    if (mode === this.mode) return;

    if (mode === "solo" && this.connectedHumans().length > 1) {
      const player = this.players.get(playerId);
      if (player) this.sendTo(player.ws, { type: "error", message: "Solo mode needs an empty room" });
      return;
    }

    this.applyMode(mode);
    this.broadcastState();
    console.log(`[Session ${this.id}] Mode set to ${mode} by host.`);
  }

  handleSetTeam(playerId: PlayerId, team: TeamId): void {
    const player = this.players.get(playerId);
    if (!player) return;
    if (this.mode !== "team") {
      this.sendTo(player.ws, { type: "error", message: "Teams are only used in team mode" });
      return;
    }
    if (this.state !== "lobby") {
      this.sendTo(player.ws, { type: "error", message: "Cannot switch squads after the game starts" });
      return;
    }

    player.team = team;
    this.broadcastState();
    console.log(`[Session ${this.id}] Player "${player.name}" joined squad ${team}.`);
  }

  handleSetBotDifficulty(playerId: PlayerId, difficulty: BotDifficulty): void {
    if (!this.requireLobbyHost(playerId, "Cannot change the rival after the game starts", "Only the host can change the rival")) return;
    if (this.mode !== "solo") {
      const player = this.players.get(playerId);
      if (player) this.sendTo(player.ws, { type: "error", message: "Rival settings are solo-only" });
      return;
    }

    this.botDifficulty = difficulty;
    this.broadcastState();
    console.log(`[Session ${this.id}] Bot difficulty set to ${difficulty}.`);
  }

  /** Shared guard for host-only lobby settings. Reports the reason it refused. */
  private requireLobbyHost(playerId: PlayerId, notInLobby: string, notHost: string): boolean {
    const player = this.players.get(playerId);
    if (this.state !== "lobby") {
      if (player) this.sendTo(player.ws, { type: "error", message: notInLobby });
      return false;
    }
    if (this.hostId !== playerId) {
      if (player) this.sendTo(player.ws, { type: "error", message: notHost });
      return false;
    }
    return true;
  }

  broadcastState(): void {
    this.broadcast({ type: "session_update", session: this.getSnapshot() });
  }

  broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const player of this.players.values()) {
      if (player.isConnected && player.ws?.readyState === WebSocket.OPEN) {
        player.ws.send(data);
      }
    }
  }

  sendTo(ws: WebSocket | null, msg: ServerMessage): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

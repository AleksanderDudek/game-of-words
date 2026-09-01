import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type WebSocket from "ws";
import { GameSession } from "./session";
import { CONFIG } from "./config";
import { buildBoard } from "../shared/board";
import { toPlayerId } from "../shared/types";
import { RULE_BOUNDS } from "../shared/rules";
import type { PlayerId, ServerMessage } from "../shared/types";

/** Minimal stand-in for a connected socket that records what it was sent. */
function fakeSocket() {
  const sent: ServerMessage[] = [];
  const ws = {
    readyState: 1, // WebSocket.OPEN
    send: (raw: string) => sent.push(JSON.parse(raw) as ServerMessage),
  } as unknown as WebSocket;
  return { ws, sent };
}

/** Drop a session straight into a live round without running the countdown. */
function primeRound(session: GameSession, word: string): void {
  session.state = "playing";
  session.roundNumber = 1;
  session.originalWord = word;
  session.hint = "a clue";
  session.board = buildBoard(word);
  session.timeLeft = CONFIG.SESSION_DURATION_SEC;
}

/**
 * Pin every roll the bot makes high. Its solve chance is capped at 0.92, so a
 * 0.99 roll always misses and always declines a hint — the bot then burns its
 * full guess allowance and the whole turn is deterministic.
 */
function botAlwaysMisses(): void {
  vi.spyOn(Math, "random").mockReturnValue(0.99);
}

describe("GameSession — solo mode", () => {
  afterEach(() => {
    // botAlwaysMisses() patches a global; leaving it in place would silently
    // rig every later test in the file.
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("seats a bot rival the moment the room is created", () => {
    const session = new GameSession("solo");
    const bots = [...session.players.values()].filter((p) => p.isBot);
    expect(bots).toHaveLength(1);
    expect(bots[0].name).toBe(CONFIG.BOT_NAME);
    session.cleanup();
  });

  it("does not count the bot as a human, so an empty room can be reclaimed", () => {
    const session = new GameSession("solo");
    expect(session.hasConnectedHumans()).toBe(false);
    expect(session.isJoinable()).toBe(true);

    session.addPlayer(fakeSocket().ws, "Alice");
    expect(session.hasConnectedHumans()).toBe(true);
    session.cleanup();
  });

  it("keeps solo rooms private once someone is in them", () => {
    const session = new GameSession("solo");
    session.addPlayer(fakeSocket().ws, "Alice");

    const intruder = fakeSocket();
    expect(session.addPlayer(intruder.ws, "Mallory")).toBe("");
    expect(intruder.sent.at(-1)).toEqual({ type: "error", message: "Solo sessions are private" });
    expect(session.isJoinable()).toBe(false);
    session.cleanup();
  });

  it("plays a guess of its own once the mic reaches it", () => {
    vi.useFakeTimers();
    const session = new GameSession("solo");
    const seat = fakeSocket();
    const human = session.addPlayer(seat.ws, "Alice") as PlayerId;
    const botId = session.botId as PlayerId;

    primeRound(session, "blaze");
    session.currentPlayerId = human;
    session.turnsRemaining = 1;

    // A miss hands the mic over; the bot then answers after its thinking pause.
    session.handleGuess(human, "wrong");
    expect(session.currentPlayerId).toBe(botId);

    seat.sent.length = 0;
    vi.advanceTimersByTime(CONFIG.BOT_TURN_BUDGET_MS + 1000);

    const botGuesses = seat.sent.filter(
      (m) => m.type === "guess_result" && m.playerId === botId,
    );
    expect(botGuesses.length).toBeGreaterThan(0);

    session.cleanup();
    vi.useRealTimers();
  });

  it("finishes its whole turn inside the configured budget", () => {
    botAlwaysMisses();
    vi.useFakeTimers();
    const session = new GameSession("solo");
    const seat = fakeSocket();
    const human = session.addPlayer(seat.ws, "Alice") as PlayerId;
    const botId = session.botId as PlayerId;

    primeRound(session, "blaze");
    session.currentPlayerId = human;
    session.turnsRemaining = 1;
    session.handleGuess(human, "wrong"); // hands the mic to the bot

    seat.sent.length = 0;
    // By the time the budget is up the bot is done thinking, whether it solved
    // the word or burned every guess — nothing is left pending on its clock.
    vi.advanceTimersByTime(CONFIG.BOT_TURN_BUDGET_MS);

    expect(session.botThinking).toBe(false);
    expect(session.botTimer).toBeNull();
    expect(session.currentPlayerId).toBe(human);
    expect(
      seat.sent.filter((m) => m.type === "guess_result" && m.playerId === botId),
    ).toHaveLength(CONFIG.TURNS_PER_PLAYER);

    session.cleanup();
    vi.useRealTimers();
  });

  it("holds the thinking flag steady across every guess of the bot's turn", () => {
    botAlwaysMisses();
    vi.useFakeTimers();
    const session = new GameSession("solo");
    const seat = fakeSocket();
    const human = session.addPlayer(seat.ws, "Alice") as PlayerId;
    const botId = session.botId as PlayerId;

    primeRound(session, "blaze");
    session.currentPlayerId = human;
    session.turnsRemaining = 1;
    session.handleGuess(human, "wrong");

    seat.sent.length = 0;
    // Step through the turn and watch what the client is actually told: while
    // the bot still holds the mic the indicator must never blink back off.
    vi.advanceTimersByTime(CONFIG.BOT_TURN_BUDGET_MS);

    const botTurnFrames = seat.sent.filter(
      (m) =>
        m.type === "session_update" &&
        m.session.state === "playing" &&
        m.session.round?.currentPlayerId === botId,
    );
    expect(botTurnFrames.length).toBeGreaterThan(0);
    for (const frame of botTurnFrames) {
      if (frame.type !== "session_update") continue;
      expect(frame.session.round?.botThinking).toBe(true);
    }

    session.cleanup();
    vi.useRealTimers();
  });

  it("clears the thinking flag in the frame that hands the mic back", () => {
    botAlwaysMisses();
    vi.useFakeTimers();
    const session = new GameSession("solo");
    const seat = fakeSocket();
    const human = session.addPlayer(seat.ws, "Alice") as PlayerId;

    primeRound(session, "blaze");
    session.currentPlayerId = human;
    session.turnsRemaining = 1;
    session.handleGuess(human, "wrong");

    seat.sent.length = 0;
    vi.advanceTimersByTime(CONFIG.BOT_TURN_BUDGET_MS + 1000);

    const humanTurnFrames = seat.sent.filter(
      (m) => m.type === "session_update" && m.session.round?.currentPlayerId === human,
    );
    expect(humanTurnFrames.length).toBeGreaterThan(0);
    for (const frame of humanTurnFrames) {
      if (frame.type !== "session_update") continue;
      expect(frame.session.round?.botThinking).toBe(false);
    }

    session.cleanup();
    vi.useRealTimers();
  });

  it("does not let the bot act while the game is paused", () => {
    vi.useFakeTimers();
    const session = new GameSession("solo");
    const seat = fakeSocket();
    const human = session.addPlayer(seat.ws, "Alice") as PlayerId;
    const botId = session.botId as PlayerId;

    primeRound(session, "blaze");
    session.currentPlayerId = human;
    session.turnsRemaining = 1;
    session.handleGuess(human, "wrong");

    session.handlePauseGame(human);
    seat.sent.length = 0;
    vi.advanceTimersByTime(CONFIG.BOT_TURN_BUDGET_MS + 5000);

    expect(seat.sent.some((m) => m.type === "guess_result" && m.playerId === botId)).toBe(false);

    session.cleanup();
    vi.useRealTimers();
  });

  it("drops the bot when the host switches away from solo", () => {
    const session = new GameSession("solo");
    const host = session.addPlayer(fakeSocket().ws, "Alice") as PlayerId;

    session.handleSetMode(host, "classic");
    expect([...session.players.values()].some((p) => p.isBot)).toBe(false);
    session.cleanup();
  });
});

describe("GameSession — team mode", () => {
  let session: GameSession;
  let alpha: PlayerId;
  let bravo: PlayerId;

  beforeEach(() => {
    vi.useFakeTimers();
    session = new GameSession("team");
    alpha = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;
    bravo = session.addPlayer(fakeSocket().ws, "Bo") as PlayerId;
  });

  afterEach(() => {
    session.cleanup();
    vi.useRealTimers();
  });

  it("balances joiners across the two squads", () => {
    expect(session.players.get(alpha)?.team).toBe("alpha");
    expect(session.players.get(bravo)?.team).toBe("bravo");
  });

  it("lets a player switch squads in the lobby", () => {
    session.handleSetTeam(bravo, "alpha");
    expect(session.players.get(bravo)?.team).toBe("alpha");
  });

  it("opens a steal window for the other squad when an attack runs dry", () => {
    primeRound(session, "blaze");
    session.attackingTeam = "alpha";
    session.roundPhase = "attack";
    session.turnsRemaining = 1;
    session.currentPlayerId = alpha;
    session.teamMic = { alpha, bravo: "" };

    session.handleGuess(alpha, "wrong");

    expect(session.roundPhase).toBe("steal");
    expect(session.attackingTeam).toBe("bravo");
    expect(session.currentPlayerId).toBe(bravo);
    expect(session.turnsRemaining).toBe(1);
    expect(session.timeLeft).toBe(CONFIG.STEAL_SECONDS);
    expect(session.state).toBe("playing");
  });

  it("pays a steal at the reduced rate, to the thief's squad", () => {
    primeRound(session, "blaze");
    session.attackingTeam = "bravo";
    session.roundPhase = "steal";
    session.turnsRemaining = 1;
    session.currentPlayerId = bravo;
    session.timeLeft = CONFIG.STEAL_SECONDS;

    session.handleGuess(bravo, "blaze");

    expect(session.teamScores.bravo).toBeGreaterThan(0);
    expect(session.teamScores.bravo).toBeLessThan(CONFIG.POINTS_PER_CORRECT);
    expect(session.teamScores.alpha).toBe(0);
    expect(session.teamSolved.bravo).toBe(1);
    expect(session.state).toBe("round_end");
  });

  it("fails the round outright when the steal is missed too", () => {
    primeRound(session, "blaze");
    session.attackingTeam = "bravo";
    session.roundPhase = "steal";
    session.turnsRemaining = 1;
    session.currentPlayerId = bravo;

    session.handleGuess(bravo, "wrong");

    expect(session.state).toBe("round_end");
    expect(session.teamScores.alpha).toBe(0);
    expect(session.teamScores.bravo).toBe(0);
  });

  it("pays hints out of the squad bank, not the player's own score", () => {
    primeRound(session, "network");
    session.attackingTeam = "alpha";
    session.roundPhase = "attack";
    session.currentPlayerId = alpha;
    session.teamScores.alpha = 100;

    session.handleBuyHint(alpha);

    expect(session.teamScores.alpha).toBe(100 - CONFIG.HINT_COST_POINTS);
    expect(session.players.get(alpha)?.score).toBe(0);
  });

  it("refuses hints to the squad that is not on the clock", () => {
    primeRound(session, "network");
    session.attackingTeam = "alpha";
    session.roundPhase = "attack";
    session.currentPlayerId = alpha;
    session.teamScores.bravo = 500;

    session.handleBuyHint(bravo);

    expect(session.teamScores.bravo).toBe(500);
  });
});

describe("GameSession — coop mode", () => {
  let session: GameSession;
  let ana: PlayerId;
  let bo: PlayerId;

  beforeEach(() => {
    vi.useFakeTimers();
    session = new GameSession("coop");
    ana = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;
    bo = session.addPlayer(fakeSocket().ws, "Bo") as PlayerId;
    primeRound(session, "blaze");
    session.coopGuessesPerRound = 3;
    session.coopGuessesLeft = 3;
    session.turnsRemaining = 3;
    session.currentPlayerId = ana;
  });

  afterEach(() => {
    session.cleanup();
    vi.useRealTimers();
  });

  it("burns one shared guess per miss and passes the mic", () => {
    session.handleGuess(ana, "wrong");

    expect(session.coopGuessesLeft).toBe(2);
    expect(session.currentPlayerId).toBe(bo);
  });

  it("costs a life when the shared pool runs out", () => {
    session.coopGuessesLeft = 1;

    session.handleGuess(ana, "wrong");

    expect(session.coopLives).toBe(CONFIG.COOP_LIVES - 1);
    expect(session.coopFailed).toBe(1);
    expect(session.state).toBe("round_end");
  });

  it("banks a solve for the table while still crediting the solver", () => {
    session.handleGuess(ana, "blaze");

    expect(session.coopBank).toBeGreaterThan(0);
    expect(session.coopCleared).toBe(1);
    expect(session.players.get(ana)?.score).toBe(session.coopBank);
  });

  it("lets any player spend from the shared bank, not just the one on the mic", () => {
    session.coopBank = 200;

    session.handleBuyHint(bo);

    expect(session.coopBank).toBe(200 - CONFIG.HINT_COST_POINTS);
  });

  it("charges a guess for passing, so the mic cannot be cycled for free", () => {
    session.handlePassTurn(ana);

    expect(session.coopGuessesLeft).toBe(2);
    expect(session.currentPlayerId).toBe(bo);
  });
});

describe("GameSession — classic mode is unchanged", () => {
  it("consumes a personal guess and only switches player when they run out", () => {
    vi.useFakeTimers();
    const session = new GameSession("classic");
    const ana = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;
    const bo = session.addPlayer(fakeSocket().ws, "Bo") as PlayerId;
    primeRound(session, "blaze");
    session.currentPlayerId = ana;
    session.turnsRemaining = 2;

    session.handleGuess(ana, "wrong");
    expect(session.currentPlayerId).toBe(ana);
    expect(session.turnsRemaining).toBe(1);

    session.handleGuess(ana, "wrong");
    expect(session.currentPlayerId).toBe(bo);
    expect(session.turnsRemaining).toBe(CONFIG.TURNS_PER_PLAYER);

    session.cleanup();
    vi.useRealTimers();
  });

  it("pays hints from the guesser's own score", () => {
    vi.useFakeTimers();
    const session = new GameSession("classic");
    const ana = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;
    primeRound(session, "network");
    session.currentPlayerId = ana;
    session.players.get(ana)!.score = 90;

    session.handleBuyHint(ana);

    expect(session.players.get(ana)?.score).toBe(90 - CONFIG.HINT_COST_POINTS);
    session.cleanup();
    vi.useRealTimers();
  });
});

describe("GameSession — snapshots", () => {
  it("exposes only the mode state the client needs", () => {
    const classic = new GameSession("classic");
    expect(classic.getSnapshot().mode).toBe("classic");
    expect(classic.getSnapshot().teams).toBeUndefined();
    expect(classic.getSnapshot().coop).toBeUndefined();
    classic.cleanup();

    const team = new GameSession("team");
    expect(team.getSnapshot().teams).toHaveLength(2);
    team.cleanup();

    const coop = new GameSession("coop");
    expect(coop.getSnapshot().coop?.maxLives).toBe(CONFIG.COOP_LIVES);
    coop.cleanup();

    const solo = new GameSession("solo");
    expect(solo.getSnapshot().botDifficulty).toBe("adaptive");
    solo.cleanup();
  });

  it("never leaks unrevealed letters", () => {
    const session = new GameSession("classic");
    primeRound(session, "network");
    const board = session.getSnapshot().round!.board;
    const hidden = board.filter((c) => !c.isFixed && !c.isRevealed);
    expect(hidden.every((c) => c.original === "?")).toBe(true);
    session.cleanup();
  });
});

describe("GameSession — mode guards", () => {
  it("only lets the host change the mode, and only in the lobby", () => {
    const session = new GameSession("classic");
    const host = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;
    const guest = fakeSocket();
    const guestId = session.addPlayer(guest.ws, "Bo") as PlayerId;

    session.handleSetMode(guestId, "coop");
    expect(session.mode).toBe("classic");
    expect(guest.sent.at(-1)).toEqual({
      type: "error",
      message: "Only the host can change the mode",
    });

    session.handleSetMode(host, "coop");
    expect(session.mode).toBe("coop");

    session.state = "playing";
    session.handleSetMode(host, "team");
    expect(session.mode).toBe("coop");
    session.cleanup();
  });

  it("refuses solo mode while the room has company", () => {
    const session = new GameSession("classic");
    const host = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;
    session.addPlayer(fakeSocket().ws, "Bo");

    session.handleSetMode(host, "solo");

    expect(session.mode).toBe("classic");
    session.cleanup();
  });

  it("re-balances squads when switching into team mode", () => {
    const session = new GameSession("classic");
    const host = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;
    session.addPlayer(fakeSocket().ws, "Bo");
    session.addPlayer(fakeSocket().ws, "Cy");

    session.handleSetMode(host, "team");

    const teams = [...session.players.values()].map((p) => p.team);
    expect(teams.filter((t) => t === "alpha")).toHaveLength(2);
    expect(teams.filter((t) => t === "bravo")).toHaveLength(1);
    session.cleanup();
  });

  it("ignores team switches outside team mode", () => {
    const session = new GameSession("classic");
    const id = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;
    session.handleSetTeam(id, "bravo");
    expect(session.players.get(toPlayerId(id))?.team).toBeUndefined();
    session.cleanup();
  });
});

describe("GameSession — custom lobby rules", () => {
  it("falls back to the server config while the host leaves the rules alone", () => {
    const session = new GameSession("classic");
    expect(session.rules).toEqual({});
    expect(session.roundSeconds()).toBe(CONFIG.SESSION_DURATION_SEC);
    expect(session.guessesPerTurn()).toBe(CONFIG.TURNS_PER_PLAYER);
    expect(session.coopGuessBase()).toBe(CONFIG.COOP_GUESSES_BASE);
    expect(session.livesForMode()).toBe(CONFIG.COOP_LIVES);
    session.cleanup();
  });

  it("plays the full difficulty ramp when no word goal is set", () => {
    const session = new GameSession("classic");
    const ramp = (CONFIG.MAX_WORD_LENGTH - CONFIG.MIN_WORD_LENGTH + 1) * CONFIG.WORDS_PER_DIFFICULTY;
    expect(session.wordCount()).toBe(ramp);
    session.cleanup();
  });

  it("lets the host override the clock, the guesses and the lives", () => {
    const session = new GameSession("coop");
    const host = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;

    session.handleSetRules(host, { roundSeconds: 90, guessesPerTurn: 5, coopLives: 6, wordGoal: 12 });

    expect(session.roundSeconds()).toBe(90);
    expect(session.guessesPerTurn()).toBe(5);
    expect(session.coopGuessBase()).toBe(5);
    expect(session.livesForMode()).toBe(6);
    expect(session.coopLives).toBe(6);
    expect(session.wordCount()).toBe(12);
    session.cleanup();
  });

  it("clamps values that arrive outside their bounds", () => {
    const session = new GameSession("classic");
    const host = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;

    session.handleSetRules(host, { roundSeconds: 9000, guessesPerTurn: 0 } as never);

    expect(session.roundSeconds()).toBe(RULE_BOUNDS.roundSeconds.max);
    expect(session.guessesPerTurn()).toBe(RULE_BOUNDS.guessesPerTurn.min);
    session.cleanup();
  });

  it("resets to the server defaults when the host clears the rules", () => {
    const session = new GameSession("classic");
    const host = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;

    session.handleSetRules(host, { roundSeconds: 90 });
    session.handleSetRules(host, null);

    expect(session.rules).toEqual({});
    expect(session.roundSeconds()).toBe(CONFIG.SESSION_DURATION_SEC);
    session.cleanup();
  });

  it("only lets the host change the rules, and only in the lobby", () => {
    const session = new GameSession("classic");
    const host = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;
    const guest = fakeSocket();
    const guestId = session.addPlayer(guest.ws, "Bo") as PlayerId;

    session.handleSetRules(guestId, { roundSeconds: 120 });
    expect(session.roundSeconds()).toBe(CONFIG.SESSION_DURATION_SEC);
    expect(guest.sent.at(-1)).toEqual({ type: "error", message: "Only the host can change the rules" });

    session.state = "playing";
    session.handleSetRules(host, { roundSeconds: 120 });
    expect(session.roundSeconds()).toBe(CONFIG.SESSION_DURATION_SEC);
    session.cleanup();
  });

  it("hands out the host's clock and guess count to a fresh round", async () => {
    const session = new GameSession("classic");
    const host = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;
    session.addPlayer(fakeSocket().ws, "Bo");
    session.handleSetRules(host, { roundSeconds: 77, guessesPerTurn: 6 });

    await session.startNewRound();

    expect(session.timeLeft).toBe(77);
    expect(session.turnsRemaining).toBe(6);
    session.cleanup();
  });

  it("ends the run once the word goal is reached", () => {
    vi.useFakeTimers();
    const session = new GameSession("classic");
    const host = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;
    session.addPlayer(fakeSocket().ws, "Bo");
    session.handleSetRules(host, { wordGoal: 3 });

    const internals = session as unknown as { scheduleNextRound(): void };

    session.state = "round_end";
    session.roundNumber = 2;
    internals.scheduleNextRound();
    vi.advanceTimersByTime(3000);
    expect(session.state).toBe("playing");

    session.state = "round_end";
    session.roundNumber = 3;
    internals.scheduleNextRound();
    vi.advanceTimersByTime(3000);
    expect(session.state).toBe("game_over");

    session.cleanup();
    vi.useRealTimers();
  });

  it("holds the difficulty ramp at the ceiling while a word goal is running", () => {
    const session = new GameSession("classic");
    const host = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;
    session.handleSetRules(host, { wordGoal: 200 });
    session.currentDifficulty = CONFIG.MAX_WORD_LENGTH;

    for (let i = 0; i < CONFIG.WORDS_PER_DIFFICULTY * 3; i++) session.progressDifficulty();

    expect(session.currentDifficulty).toBe(CONFIG.MAX_WORD_LENGTH);
    session.cleanup();
  });

  it("reports the effective rules in the snapshot, not the raw config", () => {
    const session = new GameSession("classic");
    const host = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;
    session.handleSetRules(host, { roundSeconds: 90, guessesPerTurn: 5, wordGoal: 20 });

    const snap = session.getSnapshot();
    expect(snap.config.sessionDurationSec).toBe(90);
    expect(snap.config.turnsPerPlayer).toBe(5);
    expect(snap.config.wordCount).toBe(20);
    expect(snap.rules).toEqual({ roundSeconds: 90, guessesPerTurn: 5, wordGoal: 20 });
    session.cleanup();
  });

  it("omits the rules from the snapshot while they are untouched", () => {
    const session = new GameSession("classic");
    expect(session.getSnapshot().rules).toBeUndefined();
    session.cleanup();
  });
});

describe("GameSession — multi-pack selection", () => {
  const pack = (name: string, words: string[]) => ({
    type: "custom" as const,
    name,
    words: words.map((w) => ({ word: w, hint: `clue for ${w}` })),
  });

  it("keeps every selected pack and merges them into one pool", () => {
    const session = new GameSession("classic");
    const host = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;

    session.handleSetWordPacks(host, [pack("Alpha", ["signal", "decay"]), pack("Bravo", ["cipher"])]);

    expect(session.selectedPacks.map((p) => p.name)).toEqual(["Alpha", "Bravo"]);
    expect(session.selectedWordCount()).toBe(3);
    session.cleanup();
  });

  it("counts a word shared by two packs only once", () => {
    const session = new GameSession("classic");
    const host = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;

    session.handleSetWordPacks(host, [pack("Alpha", ["signal"]), pack("Bravo", ["signal", "decay"])]);

    expect(session.selectedWordCount()).toBe(2);
    session.cleanup();
  });

  it("drops a pack selected twice", () => {
    const session = new GameSession("classic");
    const host = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;

    session.handleSetWordPacks(host, [pack("Alpha", ["signal"]), pack("Alpha", ["signal"])]);

    expect(session.selectedPacks).toHaveLength(1);
    session.cleanup();
  });

  it("summarises a multi-pack selection for the lobby", () => {
    const session = new GameSession("classic");
    const host = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;

    session.handleSetWordPacks(host, [pack("Alpha", ["signal"]), pack("Bravo", ["cipher"])]);

    const snap = session.getSnapshot();
    expect(snap.activePack).toEqual({ name: "Alpha + Bravo", wordCount: 2 });
    expect(snap.activePacks).toEqual([
      { key: "custom:Alpha", name: "Alpha", wordCount: 1 },
      { key: "custom:Bravo", name: "Bravo", wordCount: 1 },
    ]);
    session.cleanup();
  });

  it("still accepts a single-pack selection and a clear", () => {
    const session = new GameSession("classic");
    const host = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;

    session.handleSetWordPack(host, pack("Alpha", ["signal"]));
    expect(session.getSnapshot().activePack).toEqual({ name: "Alpha", wordCount: 1 });

    session.handleSetWordPack(host, { type: "clear" });
    expect(session.getSnapshot().activePack).toBeUndefined();
    expect(session.getSnapshot().activePacks).toEqual([]);
    session.cleanup();
  });

  it("rejects the whole selection when one pack is invalid", () => {
    const session = new GameSession("classic");
    const sock = fakeSocket();
    const host = session.addPlayer(sock.ws, "Ana") as PlayerId;

    session.handleSetWordPacks(host, [pack("Alpha", ["signal"])]);
    session.handleSetWordPacks(host, [pack("Bravo", ["cipher"]), { type: "builtin", packId: "NOPE!" }]);

    expect(session.selectedPacks.map((p) => p.name)).toEqual(["Alpha"]);
    expect(sock.sent.at(-1)).toEqual({ type: "error", message: "Invalid pack ID" });
    session.cleanup();
  });

  it("refuses a selection from anyone but the host", () => {
    const session = new GameSession("classic");
    session.addPlayer(fakeSocket().ws, "Ana");
    const guest = fakeSocket();
    const guestId = session.addPlayer(guest.ws, "Bo") as PlayerId;

    session.handleSetWordPacks(guestId, [pack("Alpha", ["signal"])]);

    expect(session.selectedPacks).toHaveLength(0);
    expect(guest.sent.at(-1)).toEqual({ type: "error", message: "Only the host can set the word pack" });
    session.cleanup();
  });

  it("draws each word once when the pool covers the word goal", async () => {
    const session = new GameSession("classic");
    const host = session.addPlayer(fakeSocket().ws, "Ana") as PlayerId;
    session.handleSetWordPacks(host, [pack("Alpha", ["signal", "decay", "cipher", "vector"])]);
    session.handleSetRules(host, { wordGoal: 3 });

    session.packQueue = [...session.selectedPacks[0].words];
    session.packQueueIndex = 0;

    const drawn: string[] = [];
    for (let i = 0; i < session.wordCount(); i++) {
      await session.startNewRound();
      drawn.push(session.originalWord);
    }

    expect(new Set(drawn).size).toBe(3);
    session.cleanup();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type WebSocket from "ws";
import { GameSession } from "./session";
import { CONFIG } from "./config";
import { buildBoard } from "../shared/board";
import { toPlayerId } from "../shared/types";
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

describe("GameSession — solo mode", () => {
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
    vi.advanceTimersByTime(CONFIG.BOT_MAX_THINK_MS + 1000);

    const botGuesses = seat.sent.filter(
      (m) => m.type === "guess_result" && m.playerId === botId,
    );
    expect(botGuesses.length).toBeGreaterThan(0);

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
    vi.advanceTimersByTime(CONFIG.BOT_MAX_THINK_MS + 5000);

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

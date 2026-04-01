import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventLog } from "./EventLog";
import { formatEvent, resolvePlayerName } from "./EventLog.utils";
import type { Player, ServerMessage, PlayerId } from "@/shared/types";

const players: Player[] = [
  { id: "p1" as PlayerId, name: "Alice", score: 50, isConnected: true },
  { id: "p2" as PlayerId, name: "Bob", score: 30, isConnected: true },
];

describe("resolvePlayerName", () => {
  it("returns player name by id", () => {
    expect(resolvePlayerName(players, "p1")).toBe("Alice");
  });

  it("returns ??? for unknown id", () => {
    expect(resolvePlayerName(players, "unknown")).toBe("???");
  });
});

describe("formatEvent", () => {
  it("formats a correct guess_result", () => {
    const ev: ServerMessage = { type: "guess_result", correct: true, guess: "blaze", playerId: "p1" };
    const entry = formatEvent(ev, players);
    expect(entry?.text).toContain("Alice");
    expect(entry?.text).toContain("correctly");
    expect(entry?.className).toContain("correct");
  });

  it("formats a wrong guess_result", () => {
    const ev: ServerMessage = { type: "guess_result", correct: false, guess: "blaze", playerId: "p1" };
    const entry = formatEvent(ev, players);
    expect(entry?.text).toContain("blaze");
    expect(entry?.className).toContain("wrong");
  });

  it("formats a round_won by player", () => {
    const ev: ServerMessage = { type: "round_won", playerId: "p2", word: "ghost", points: 120 };
    const entry = formatEvent(ev, players);
    expect(entry?.text).toContain("Bob");
    expect(entry?.text).toContain("+120");
    expect(entry?.text).toContain("ghost");
  });

  it("formats a round_won by timeout", () => {
    const ev: ServerMessage = { type: "round_won", playerId: "", word: "ghost", points: 0 };
    const entry = formatEvent(ev, players);
    expect(entry?.text).toContain("Time's up");
    expect(entry?.text).toContain("ghost");
  });

  it("formats turn_switched", () => {
    const ev: ServerMessage = { type: "turn_switched", newPlayerId: "p2", turnsRemaining: 3 };
    const entry = formatEvent(ev, players);
    expect(entry?.text).toContain("Bob");
    expect(entry?.className).toContain("turn");
  });

  it("formats error", () => {
    const ev: ServerMessage = { type: "error", message: "Not your turn" };
    const entry = formatEvent(ev, players);
    expect(entry?.text).toContain("Not your turn");
    expect(entry?.className).toContain("error");
  });

  it("returns null for unhandled event types", () => {
    const ev = { type: "pong" } as ServerMessage;
    expect(formatEvent(ev, players)).toBeNull();
  });
});

describe("EventLog component", () => {
  it("renders event messages", () => {
    const events: ServerMessage[] = [
      { type: "guess_result", correct: true, guess: "blaze", playerId: "p1" },
    ];
    render(<EventLog events={events} players={players} />);
    expect(screen.getByText(/correctly/)).toBeInTheDocument();
  });

  it("renders nothing for unknown event types", () => {
    const events: ServerMessage[] = [{ type: "pong" }];
    const { container } = render(<EventLog events={events} players={players} />);
    const log = container.firstChild as HTMLElement;
    expect(log.children.length).toBe(0);
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LobbyScreen } from "./LobbyScreen";
import type { SessionSnapshot, PlayerId, SessionId } from "@/shared/types";

const baseSession: SessionSnapshot = {
  sessionId: "ABC123" as SessionId,
  state: "lobby",
  players: [
    { id: "p1" as PlayerId, name: "Alice", score: 0, isConnected: true },
    { id: "p2" as PlayerId, name: "Bob", score: 0, isConnected: true },
  ],
  round: null,
  config: {
    pointsPerCorrect: 100,
    hintCostPoints: 30,
    turnsPerPlayer: 3,
    sessionDurationSec: 45,
    minWordLength: 4,
    maxWordLength: 10,
  },
};

const lobbyProps = {
  session: baseSession,
  playerId: "p1",
  builtinPacks: [],
  localPacks: [],
  onStartGame: vi.fn(),
  onSetPack: vi.fn(),
  onOpenMyPacks: vi.fn(),
};

describe("LobbyScreen", () => {
  it("renders the session code", () => {
    render(<LobbyScreen {...lobbyProps} />);
    expect(screen.getByText("ABC123")).toBeInTheDocument();
  });

  it("renders all player names", () => {
    render(<LobbyScreen {...lobbyProps} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows start button when 2+ players are present", () => {
    render(<LobbyScreen {...lobbyProps} />);
    expect(screen.getByRole("button", { name: /start game/i })).toBeInTheDocument();
  });

  it("hides start button and shows waiting text with < 2 players", () => {
    const session = { ...baseSession, players: [baseSession.players[0]] };
    render(<LobbyScreen {...lobbyProps} session={session} />);
    expect(screen.queryByRole("button", { name: /start game/i })).not.toBeInTheDocument();
    expect(screen.getByText(/need at least 2 players/i)).toBeInTheDocument();
  });

  it("calls onStartGame when start button is clicked", () => {
    const onStartGame = vi.fn();
    render(<LobbyScreen {...lobbyProps} onStartGame={onStartGame} />);
    fireEvent.click(screen.getByRole("button", { name: /start game/i }));
    expect(onStartGame).toHaveBeenCalledOnce();
  });

  it("renders config values", () => {
    render(<LobbyScreen {...lobbyProps} />);
    expect(screen.getByText("4→10 letters")).toBeInTheDocument();
    expect(screen.getByText("45s")).toBeInTheDocument();
    expect(screen.getByText("30 pts")).toBeInTheDocument();
  });
});

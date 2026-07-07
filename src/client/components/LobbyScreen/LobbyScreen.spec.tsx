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
  playerLimit: 4,
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
  onSetMaxPlayers: vi.fn(),
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

  it("shows the section labels", () => {
    const hostSession = { ...baseSession, hostId: "p1" as PlayerId };
    render(<LobbyScreen {...lobbyProps} session={hostSession} />);
    expect(screen.getByText(/game settings/i)).toBeInTheDocument();
    expect(screen.getByText(/word pack/i)).toBeInTheDocument();
    expect(screen.getByText(/host controls/i)).toBeInTheDocument();
  });

  it("shows the max players count and allowed range for the host", () => {
    const hostSession = { ...baseSession, hostId: "p1" as PlayerId };
    render(<LobbyScreen {...lobbyProps} session={hostSession} />);
    expect(screen.getByLabelText(/decrease max players/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/increase max players/i)).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument(); // playerLimit value renders
    expect(screen.getByText(/allowed: 2.8/i)).toBeInTheDocument(); // range hint (2–8)
  });

  it("steps the max players count for the host", () => {
    const onSetMaxPlayers = vi.fn();
    const hostSession = { ...baseSession, hostId: "p1" as PlayerId };
    render(<LobbyScreen {...lobbyProps} session={hostSession} onSetMaxPlayers={onSetMaxPlayers} />);
    fireEvent.click(screen.getByLabelText(/decrease max players/i));
    expect(onSetMaxPlayers).toHaveBeenCalledWith(3); // 4 - 1
  });

  it("hides host controls from non-hosts", () => {
    render(<LobbyScreen {...lobbyProps} />); // no hostId → viewer is not host
    expect(screen.queryByText(/host controls/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/decrease max players/i)).not.toBeInTheDocument();
  });
});

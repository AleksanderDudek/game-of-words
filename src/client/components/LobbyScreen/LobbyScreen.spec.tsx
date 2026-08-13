import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LobbyScreen } from "./LobbyScreen";
import type { SessionSnapshot, PlayerId, SessionId } from "@/shared/types";

const baseSession: SessionSnapshot = {
  sessionId: "ABC123" as SessionId,
  state: "lobby",
  mode: "classic",
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
  onSetPacks: vi.fn(),
  onSetRules: vi.fn(),
  onOpenMyPacks: vi.fn(),
  onSetMode: vi.fn(),
  onSetTeam: vi.fn(),
  onSetBotDifficulty: vi.fn(),
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

  it("shows the section labels but no host controls", () => {
    render(<LobbyScreen {...lobbyProps} />);
    expect(screen.getByText(/game settings/i)).toBeInTheDocument();
    expect(screen.getByText(/word pack/i)).toBeInTheDocument();
    expect(screen.queryByText(/host controls/i)).not.toBeInTheDocument();
  });

  it("displays max players read-only from config, with no stepper", () => {
    const session = { ...baseSession, config: { ...baseSession.config, maxPlayers: 6 } };
    render(<LobbyScreen {...lobbyProps} session={session} />);
    expect(screen.getByText(/max players/i)).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument(); // the configured max is shown
    expect(screen.queryByLabelText(/decrease max players/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/increase max players/i)).not.toBeInTheDocument();
  });
});

describe("LobbyScreen — mode selection", () => {
  it("lets the host change the mode", () => {
    const onSetMode = vi.fn();
    const session = { ...baseSession, hostId: "p1" as PlayerId };
    render(<LobbyScreen {...lobbyProps} session={session} onSetMode={onSetMode} />);
    fireEvent.click(screen.getByRole("radio", { name: /Co-op/ }));
    expect(onSetMode).toHaveBeenCalledWith("coop");
  });

  it("shows non-hosts the mode read-only", () => {
    const session = { ...baseSession, hostId: "p2" as PlayerId };
    render(<LobbyScreen {...lobbyProps} session={session} playerId="p1" />);
    expect(screen.getByRole("radio", { name: /Co-op/ })).toBeDisabled();
  });

  it("locks solo mode while other people are in the room", () => {
    const session = { ...baseSession, hostId: "p1" as PlayerId };
    render(<LobbyScreen {...lobbyProps} session={session} />);
    expect(screen.getByRole("radio", { name: /Solo/ })).toBeDisabled();
  });
});

describe("LobbyScreen — team mode", () => {
  const teamSession: SessionSnapshot = {
    ...baseSession,
    mode: "team",
    hostId: "p1" as PlayerId,
    players: [
      { id: "p1" as PlayerId, name: "Alice", score: 0, isConnected: true, team: "alpha" },
      { id: "p2" as PlayerId, name: "Bob", score: 0, isConnected: true, team: "bravo" },
    ],
  };

  it("shows both squad rosters", () => {
    render(<LobbyScreen {...lobbyProps} session={teamSession} />);
    expect(screen.getByText("ALPHA")).toBeInTheDocument();
    expect(screen.getByText("BRAVO")).toBeInTheDocument();
  });

  it("lets a player switch to the other squad but not their own", () => {
    const onSetTeam = vi.fn();
    render(<LobbyScreen {...lobbyProps} session={teamSession} onSetTeam={onSetTeam} />);
    fireEvent.click(screen.getByRole("button", { name: "JOIN" }));
    expect(onSetTeam).toHaveBeenCalledWith("bravo");
    expect(screen.getByRole("button", { name: "YOUR SQUAD" })).toBeDisabled();
  });

  it("blocks the start until both squads have a player", () => {
    const lopsided: SessionSnapshot = {
      ...teamSession,
      players: teamSession.players.map((p) => ({ ...p, team: "alpha" as const })),
    };
    render(<LobbyScreen {...lobbyProps} session={lopsided} />);
    expect(screen.getByText(/Both squads need a player/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start game/i })).not.toBeInTheDocument();
  });
});

describe("LobbyScreen — solo mode", () => {
  const soloSession: SessionSnapshot = {
    ...baseSession,
    mode: "solo",
    hostId: "p1" as PlayerId,
    botDifficulty: "adaptive",
    players: [
      { id: "p1" as PlayerId, name: "Alice", score: 0, isConnected: true },
      { id: "bot" as PlayerId, name: "CIPHER", score: 0, isConnected: true, isBot: true },
    ],
  };

  it("flags the rival and offers difficulty settings", () => {
    render(<LobbyScreen {...lobbyProps} session={soloSession} />);
    expect(screen.getByText("BOT")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ADAPTIVE" })).toBeInTheDocument();
  });

  it("reports the picked rival difficulty", () => {
    const onSetBotDifficulty = vi.fn();
    render(
      <LobbyScreen
        {...lobbyProps}
        session={soloSession}
        onSetBotDifficulty={onSetBotDifficulty}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "HARD" }));
    expect(onSetBotDifficulty).toHaveBeenCalledWith("hard");
  });

  it("can start with just the player and the bot", () => {
    render(<LobbyScreen {...lobbyProps} session={soloSession} />);
    expect(screen.getByRole("button", { name: /start game/i })).toBeInTheDocument();
  });
});

describe("LobbyScreen — game length", () => {
  it("shows the configured length and an estimate to everyone in the room", () => {
    const session = {
      ...baseSession,
      config: { ...baseSession.config, wordCount: 20, lobbyCountdownSec: 5 },
    };
    render(<LobbyScreen {...lobbyProps} session={session} />);

    expect(screen.getByText(/20 words · ≈\d+ min/)).toBeInTheDocument();
  });

  it("offers the rules panel switched off, so the room keeps the server defaults", () => {
    render(<LobbyScreen {...lobbyProps} />);
    expect(screen.getByRole("button", { name: /custom rules/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("locks the rules panel for a player who is not the host", () => {
    const session = { ...baseSession, hostId: "p2" as PlayerId };
    render(<LobbyScreen {...lobbyProps} session={session} />);
    expect(screen.getByRole("button", { name: /custom rules/i })).toBeDisabled();
  });
});

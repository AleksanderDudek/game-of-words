import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { GameScreen } from "./GameScreen";
import type { SessionSnapshot, PlayerId, SessionId } from "@/shared/types";

const baseSession: SessionSnapshot = {
  sessionId: "XYZ" as SessionId,
  state: "playing",
  mode: "classic",
  players: [
    { id: "p1" as PlayerId, name: "Alice", score: 200, isConnected: true },
    { id: "p2" as PlayerId, name: "Bob", score: 50, isConnected: true },
  ],
  round: {
    roundNumber: 2,
    board: [
      { index: 0, original: "b", current: "b", isFixed: true, isRevealed: false, swappedWith: null },
      { index: 1, original: "l", current: "z", isFixed: false, isRevealed: false, swappedWith: 2 },
      { index: 2, original: "a", current: "l", isFixed: false, isRevealed: false, swappedWith: 1 },
      { index: 3, original: "z", current: "a", isFixed: false, isRevealed: false, swappedWith: null },
      { index: 4, original: "e", current: "e", isFixed: true, isRevealed: false, swappedWith: null },
    ],
    hint: "A campfire's ambition",
    difficulty: 5,
    timeLeft: 30,
    currentPlayerId: "p1" as PlayerId,
    turnsRemaining: 3,
    wordLength: 5,
  },
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

const defaultProps = {
  session: baseSession,
  playerId: "p1",
  events: [],
  guessInput: "",
  onGuessChange: vi.fn(),
  onGuess: vi.fn(),
  onBuyHint: vi.fn(),
  inputRef: createRef<HTMLInputElement>(),
};

describe("GameScreen", () => {
  it("renders the round number", () => {
    render(<GameScreen {...defaultProps} />);
    expect(screen.getByText(/ROUND 2/)).toBeInTheDocument();
  });

  it("renders the hint text", () => {
    render(<GameScreen {...defaultProps} />);
    expect(screen.getByText("A campfire's ambition")).toBeInTheDocument();
  });

  it("renders board cells", () => {
    render(<GameScreen {...defaultProps} />);
    expect(screen.getByText("b")).toBeInTheDocument();
  });

  it("shows YOUR TURN when it is the player's turn", () => {
    render(<GameScreen {...defaultProps} playerId="p1" />);
    expect(screen.getByText("YOUR TURN")).toBeInTheDocument();
  });

  it("hides YOUR TURN when it is not the player's turn", () => {
    render(<GameScreen {...defaultProps} playerId="p2" />);
    expect(screen.queryByText("YOUR TURN")).not.toBeInTheDocument();
  });

  it("enables guess button when it is player's turn and input has text", () => {
    render(<GameScreen {...defaultProps} playerId="p1" guessInput="blaze" />);
    const btn = screen.getByRole("button", { name: /guess/i });
    expect(btn).not.toBeDisabled();
  });

  it("disables guess button when input is empty", () => {
    render(<GameScreen {...defaultProps} playerId="p1" guessInput="" />);
    const btn = screen.getByRole("button", { name: /guess/i });
    expect(btn).toBeDisabled();
  });

  it("calls onGuess when GUESS button clicked", () => {
    const onGuess = vi.fn();
    render(<GameScreen {...defaultProps} playerId="p1" guessInput="blaze" onGuess={onGuess} />);
    fireEvent.click(screen.getByRole("button", { name: /guess/i }));
    expect(onGuess).toHaveBeenCalledOnce();
  });

  it("disables hint button when player cannot afford hint", () => {
    const sessionPoor = {
      ...baseSession,
      players: [
        { id: "p1" as PlayerId, name: "Alice", score: 0, isConnected: true },
        { id: "p2" as PlayerId, name: "Bob", score: 0, isConnected: true },
      ],
    };
    render(<GameScreen {...defaultProps} session={sessionPoor} />);
    const hintBtn = screen.getByRole("button", { name: /reveal pair/i });
    expect(hintBtn).toBeDisabled();
  });
});

describe("GameScreen — team mode", () => {
  const teamSession: SessionSnapshot = {
    ...baseSession,
    mode: "team",
    players: [
      { id: "p1" as PlayerId, name: "Alice", score: 200, isConnected: true, team: "alpha" },
      { id: "p2" as PlayerId, name: "Bob", score: 50, isConnected: true, team: "bravo" },
    ],
    teams: [
      { id: "alpha", score: 260, solved: 2 },
      { id: "bravo", score: 90, solved: 1 },
    ],
    round: { ...baseSession.round!, attackingTeam: "alpha", phase: "attack" },
  };

  it("shows the squad scoreboard and who is on the word", () => {
    render(<GameScreen {...defaultProps} session={teamSession} />);
    expect(screen.getByText("260")).toBeInTheDocument();
    expect(screen.getByText("ALPHA is on the word")).toBeInTheDocument();
  });

  it("announces the steal window", () => {
    const stealing: SessionSnapshot = {
      ...teamSession,
      round: { ...teamSession.round!, attackingTeam: "bravo", phase: "steal" },
    };
    render(<GameScreen {...defaultProps} session={stealing} />);
    expect(screen.getByText(/STEAL — BRAVO has one guess/)).toBeInTheDocument();
  });

  it("spends hints from the squad bank", () => {
    render(<GameScreen {...defaultProps} session={teamSession} />);
    expect(screen.getByText("Squad bank: 260")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reveal pair/i })).not.toBeDisabled();
  });

  it("refuses reveals to the squad that is not on the clock", () => {
    const defending: SessionSnapshot = {
      ...teamSession,
      round: { ...teamSession.round!, attackingTeam: "bravo" },
    };
    render(<GameScreen {...defaultProps} session={defending} />);
    expect(screen.getByRole("button", { name: /reveal pair/i })).toBeDisabled();
  });
});

describe("GameScreen — coop mode", () => {
  const coopSession: SessionSnapshot = {
    ...baseSession,
    mode: "coop",
    coop: {
      bank: 300,
      livesLeft: 2,
      maxLives: 3,
      guessesLeft: 3,
      guessesPerRound: 5,
      roundsCleared: 4,
      roundsFailed: 1,
    },
  };

  it("shows the shared resources", () => {
    render(<GameScreen {...defaultProps} session={coopSession} />);
    expect(screen.getByLabelText("2 lives left")).toBeInTheDocument();
    expect(screen.getByText("3/5")).toBeInTheDocument();
  });

  it("describes the guess pool as shared", () => {
    render(<GameScreen {...defaultProps} session={coopSession} playerId="p1" />);
    expect(screen.getByText("3 guesses left in the pool")).toBeInTheDocument();
  });

  it("spends hints from the shared bank", () => {
    render(<GameScreen {...defaultProps} session={coopSession} />);
    expect(screen.getByText("Shared bank: 300")).toBeInTheDocument();
  });
});

describe("GameScreen — solo mode", () => {
  const soloSession: SessionSnapshot = {
    ...baseSession,
    mode: "solo",
    players: [
      { id: "p1" as PlayerId, name: "Alice", score: 200, isConnected: true },
      { id: "bot" as PlayerId, name: "CIPHER", score: 150, isConnected: true, isBot: true },
    ],
    round: { ...baseSession.round!, currentPlayerId: "bot" as PlayerId, botThinking: true },
  };

  it("shows the rival thinking on its turn", () => {
    render(<GameScreen {...defaultProps} session={soloSession} />);
    expect(screen.getByText("CIPHER is thinking…")).toBeInTheDocument();
  });

  it("falls back to a plain turn label once it has answered", () => {
    const answered: SessionSnapshot = {
      ...soloSession,
      round: { ...soloSession.round!, botThinking: false },
    };
    render(<GameScreen {...defaultProps} session={answered} />);
    expect(screen.getByText("CIPHER's turn")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { GameScreen } from "./GameScreen";
import type { SessionSnapshot, PlayerId, SessionId } from "@/shared/types";

const baseSession: SessionSnapshot = {
  sessionId: "XYZ" as SessionId,
  state: "playing",
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

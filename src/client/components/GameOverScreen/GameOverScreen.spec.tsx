import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GameOverScreen } from "./GameOverScreen";
import type { Player, PlayerId } from "@/shared/types";

const players: Player[] = [
  { id: "p1" as PlayerId, name: "Alice", score: 350, isConnected: true },
  { id: "p2" as PlayerId, name: "Bob", score: 120, isConnected: false },
  { id: "p3" as PlayerId, name: "Carol", score: 200, isConnected: true },
];

describe("GameOverScreen", () => {
  it("renders the title", () => {
    render(<GameOverScreen players={players} playerId="p1" onNewGame={vi.fn()} />);
    expect(screen.getByText("SIGNAL LOST")).toBeInTheDocument();
  });

  it("sorts players by score descending", () => {
    render(<GameOverScreen players={players} playerId="p1" onNewGame={vi.fn()} />);
    const ranks = screen.getAllByText(/^#\d+/);
    expect(ranks[0].textContent).toBe("#1");
    // Alice (350) should be first
    const names = screen.getAllByText(/Alice|Bob|Carol/);
    expect(names[0].textContent).toContain("Alice");
  });

  it("shows YOU badge for the current player", () => {
    render(<GameOverScreen players={players} playerId="p2" onNewGame={vi.fn()} />);
    expect(screen.getByText("YOU")).toBeInTheDocument();
  });

  it("applies winner class to first row", () => {
    const { container } = render(
      <GameOverScreen players={players} playerId="p1" onNewGame={vi.fn()} />
    );
    const rows = container.querySelectorAll("[class*='lb-row']");
    expect(rows[0].className).toMatch(/winner/);
    expect(rows[1].className).not.toMatch(/winner/);
  });

  it("calls onNewGame when NEW GAME button is clicked", () => {
    const onNewGame = vi.fn();
    render(<GameOverScreen players={players} playerId="p1" onNewGame={onNewGame} />);
    fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    expect(onNewGame).toHaveBeenCalledOnce();
  });
});

describe("GameOverScreen — team mode", () => {
  const squads: Player[] = [
    { id: "p1" as PlayerId, name: "Alice", score: 350, isConnected: true, team: "alpha" },
    { id: "p2" as PlayerId, name: "Bob", score: 120, isConnected: true, team: "bravo" },
  ];

  it("declares the winning squad and the MVP", () => {
    render(
      <GameOverScreen
        players={squads}
        playerId="p1"
        mode="team"
        teams={[
          { id: "alpha", score: 350, solved: 4 },
          { id: "bravo", score: 120, solved: 1 },
        ]}
        onNewGame={vi.fn()}
      />
    );
    expect(screen.getByText("ALPHA takes it")).toBeInTheDocument();
    expect(screen.getByText("MVP: Alice · 350 pts")).toBeInTheDocument();
  });

  it("reports a level score as a draw", () => {
    render(
      <GameOverScreen
        players={squads}
        playerId="p1"
        mode="team"
        teams={[
          { id: "alpha", score: 200, solved: 2 },
          { id: "bravo", score: 200, solved: 2 },
        ]}
        onNewGame={vi.fn()}
      />
    );
    expect(screen.getByText("Dead heat — no squad ahead")).toBeInTheDocument();
  });
});

describe("GameOverScreen — coop mode", () => {
  it("grades the run instead of crowning a winner", () => {
    render(
      <GameOverScreen
        players={players}
        playerId="p1"
        mode="coop"
        coop={{
          bank: 640,
          livesLeft: 0,
          maxLives: 3,
          guessesLeft: 0,
          guessesPerRound: 5,
          roundsCleared: 9,
          roundsFailed: 1,
        }}
        onNewGame={vi.fn()}
      />
    );
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText("9 words cleared")).toBeInTheDocument();
    expect(screen.getByText("640 pts banked")).toBeInTheDocument();
    expect(screen.getByText("Contributions")).toBeInTheDocument();
  });
});

describe("GameOverScreen — solo mode", () => {
  const duel: Player[] = [
    { id: "p1" as PlayerId, name: "Alice", score: 300, isConnected: true },
    { id: "bot" as PlayerId, name: "CIPHER", score: 180, isConnected: true, isBot: true },
  ];

  it("says who out-decoded whom", () => {
    render(<GameOverScreen players={duel} playerId="p1" mode="solo" onNewGame={vi.fn()} />);
    expect(screen.getByText("You out-decoded CIPHER")).toBeInTheDocument();
  });

  it("reports a loss to the rival", () => {
    const behind = [duel[0], { ...duel[1], score: 900 }];
    render(<GameOverScreen players={behind} playerId="p1" mode="solo" onNewGame={vi.fn()} />);
    expect(screen.getByText("CIPHER out-decoded you")).toBeInTheDocument();
  });
});

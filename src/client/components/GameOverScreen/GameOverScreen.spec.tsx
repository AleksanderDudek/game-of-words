import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GameOverScreen } from "./GameOverScreen";
import type { Player } from "@/shared/types";

const players: Player[] = [
  { id: "p1", name: "Alice", score: 350, isConnected: true },
  { id: "p2", name: "Bob", score: 120, isConnected: false },
  { id: "p3", name: "Carol", score: 200, isConnected: true },
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

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerCard } from "./PlayerCard";
import type { Player, PlayerId } from "@/shared/types";

const makePlayer = (overrides?: Partial<Player>): Player => ({
  id: "p1" as PlayerId,
  name: "Alice",
  score: 100,
  isConnected: true,
  ...overrides,
});

describe("PlayerCard", () => {
  it("renders the player name", () => {
    render(<PlayerCard player={makePlayer()} isCurrent={false} isYou={false} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders the player score", () => {
    render(<PlayerCard player={makePlayer({ score: 250 })} isCurrent={false} isYou={false} />);
    expect(screen.getByText("250 pts")).toBeInTheDocument();
  });

  it("shows YOU badge when isYou is true", () => {
    render(<PlayerCard player={makePlayer()} isCurrent={false} isYou={true} />);
    expect(screen.getByText("YOU")).toBeInTheDocument();
  });

  it("does not show YOU badge when isYou is false", () => {
    render(<PlayerCard player={makePlayer()} isCurrent={false} isYou={false} />);
    expect(screen.queryByText("YOU")).not.toBeInTheDocument();
  });

  it("shows turn arrow when isCurrent is true", () => {
    render(<PlayerCard player={makePlayer()} isCurrent={true} isYou={false} />);
    expect(screen.getByText("▸")).toBeInTheDocument();
  });

  it("applies current class when isCurrent", () => {
    const { container } = render(
      <PlayerCard player={makePlayer()} isCurrent={true} isYou={false} />
    );
    expect((container.firstChild as HTMLElement).className).toMatch(/current/);
  });

  it("applies you class when isYou", () => {
    const { container } = render(
      <PlayerCard player={makePlayer()} isCurrent={false} isYou={true} />
    );
    expect((container.firstChild as HTMLElement).className).toMatch(/[_-]you[_-]/);
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoopStatus } from "./CoopStatus";
import type { CoopState } from "@/shared/types";

const coop: CoopState = {
  bank: 240,
  livesLeft: 2,
  maxLives: 3,
  guessesLeft: 4,
  guessesPerRound: 5,
  roundsCleared: 6,
  roundsFailed: 1,
};

describe("CoopStatus", () => {
  it("shows the shared bank, pool and clear count", () => {
    render(<CoopStatus coop={coop} />);
    expect(screen.getByText("240")).toBeInTheDocument();
    expect(screen.getByText("4/5")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("labels how many lives are left for screen readers", () => {
    render(<CoopStatus coop={coop} />);
    expect(screen.getByLabelText("2 lives left")).toBeInTheDocument();
  });

  it("renders one marker per life, spent ones included", () => {
    render(<CoopStatus coop={coop} />);
    const lives = screen.getByLabelText("2 lives left");
    expect(lives.textContent).toBe("◆◆◇");
  });

  it("handles a run down to its last life", () => {
    render(<CoopStatus coop={{ ...coop, livesLeft: 1 }} />);
    expect(screen.getByLabelText("1 life left").textContent).toBe("◆◇◇");
  });
});

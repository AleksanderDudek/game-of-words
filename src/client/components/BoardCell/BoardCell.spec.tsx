import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BoardCell } from "./BoardCell";
import type { LetterCell } from "@/shared/types";

const makeCell = (overrides?: Partial<LetterCell>): LetterCell => ({
  index: 0,
  original: "a",
  current: "a",
  isFixed: false,
  isRevealed: false,
  swappedWith: null,
  ...overrides,
});

describe("BoardCell", () => {
  it("renders the current character", () => {
    render(<BoardCell cell={makeCell({ current: "z" })} index={0} />);
    expect(screen.getByText("z")).toBeInTheDocument();
  });

  it("renders the index number", () => {
    render(<BoardCell cell={makeCell()} index={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("applies animation delay based on index", () => {
    const { container } = render(<BoardCell cell={makeCell()} index={2} />);
    const cell = container.firstChild as HTMLElement;
    expect(cell.style.animationDelay).toBe("80ms");
  });

  it("includes fixed class for fixed cells", () => {
    const { container } = render(
      <BoardCell cell={makeCell({ isFixed: true })} index={0} />
    );
    const cell = container.firstChild as HTMLElement;
    expect(cell.className).toMatch(/fixed/);
  });

  it("includes revealed class for revealed cells", () => {
    const { container } = render(
      <BoardCell cell={makeCell({ isRevealed: true })} index={0} />
    );
    const cell = container.firstChild as HTMLElement;
    expect(cell.className).toMatch(/revealed/);
  });

  it("includes swapped class when cell is swapped but not revealed", () => {
    const { container } = render(
      <BoardCell
        cell={makeCell({ isFixed: false, isRevealed: false, swappedWith: 2 })}
        index={0}
      />
    );
    const cell = container.firstChild as HTMLElement;
    expect(cell.className).toMatch(/swapped/);
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModePicker } from "./ModePicker";

const defaultProps = {
  value: "classic" as const,
  onChange: vi.fn(),
};

describe("ModePicker", () => {
  it("offers every mode", () => {
    render(<ModePicker {...defaultProps} />);
    for (const name of ["Classic", "Teams", "Co-op", "Solo"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("marks the active mode as checked", () => {
    render(<ModePicker {...defaultProps} value="coop" />);
    const coop = screen.getByRole("radio", { name: /Co-op/ });
    expect(coop).toHaveAttribute("aria-checked", "true");
  });

  it("reports the picked mode", () => {
    const onChange = vi.fn();
    render(<ModePicker {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /Teams/ }));
    expect(onChange).toHaveBeenCalledWith("team");
  });

  it("shows taglines in full form and hides them when compact", () => {
    const { rerender } = render(<ModePicker {...defaultProps} />);
    expect(screen.getByText("Free-for-all duel")).toBeInTheDocument();

    rerender(<ModePicker {...defaultProps} compact />);
    expect(screen.queryByText("Free-for-all duel")).not.toBeInTheDocument();
  });

  it("disables every option when read-only", () => {
    render(<ModePicker {...defaultProps} disabled />);
    for (const option of screen.getAllByRole("radio")) {
      expect(option).toBeDisabled();
    }
  });

  it("locks individual modes and explains why", () => {
    render(<ModePicker {...defaultProps} lockedModes={{ solo: "Solo needs a room to yourself" }} />);
    const solo = screen.getByRole("radio", { name: /Solo/ });
    expect(solo).toBeDisabled();
    expect(solo).toHaveAttribute("title", "Solo needs a room to yourself");
    expect(screen.getByRole("radio", { name: /Teams/ })).not.toBeDisabled();
  });
});

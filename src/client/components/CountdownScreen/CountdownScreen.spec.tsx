import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CountdownScreen } from "./CountdownScreen";

describe("CountdownScreen", () => {
  it("renders the countdown number", () => {
    render(<CountdownScreen countdownLeft={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders the label", () => {
    render(<CountdownScreen countdownLeft={5} />);
    expect(screen.getByText("SIGNAL INCOMING")).toBeInTheDocument();
  });
});

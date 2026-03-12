import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimerBar } from "./TimerBar";
import { getTimerPercent, isUrgent, formatTime } from "./TimerBar.utils";

describe("TimerBar utils", () => {
  it("calculates percentage correctly", () => {
    expect(getTimerPercent(30, 60)).toBe(50);
    expect(getTimerPercent(60, 60)).toBe(100);
    expect(getTimerPercent(0, 60)).toBe(0);
  });

  it("clamps percent between 0 and 100", () => {
    expect(getTimerPercent(-5, 60)).toBe(0);
    expect(getTimerPercent(70, 60)).toBe(100);
  });

  it("detects urgent state below 25%", () => {
    expect(isUrgent(24)).toBe(true);
    expect(isUrgent(25)).toBe(false);
    expect(isUrgent(50)).toBe(false);
  });

  it("formats time as M:SS", () => {
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(59)).toBe("0:59");
  });
});

describe("TimerBar component", () => {
  it("renders the formatted time", () => {
    render(<TimerBar timeLeft={90} total={120} />);
    expect(screen.getByText("1:30")).toBeInTheDocument();
  });

  it("sets fill width based on percentage", () => {
    const { container } = render(<TimerBar timeLeft={30} total={60} />);
    const fill = container.querySelector("[style]") as HTMLElement;
    expect(fill.style.width).toBe("50%");
  });
});

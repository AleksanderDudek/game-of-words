import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ConnectingScreen } from "./ConnectingScreen";

beforeEach(() => {
  vi.useFakeTimers();
  // Mock fetch to return fallback (avoid real network calls in tests)
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network"));
});

describe("ConnectingScreen", () => {
  it("renders the connecting title", () => {
    render(<ConnectingScreen />);
    expect(
      screen.getByText(/ESTABLISHING CONNECTION/i)
    ).toBeInTheDocument();
  });

  it("renders the hint about server waking up", () => {
    render(<ConnectingScreen />);
    expect(
      screen.getByText(/server is waking up/i)
    ).toBeInTheDocument();
  });

  it("renders a joke setup from fallback jokes", () => {
    render(<ConnectingScreen />);
    // The first fallback joke should be visible
    expect(
      screen.getByText("Why do programmers prefer dark mode?")
    ).toBeInTheDocument();
  });

  it("reveals punchline after delay", () => {
    render(<ConnectingScreen />);
    const punchline = screen.getByText("Because light attracts bugs.");
    // Initially hidden (no .visible class)
    expect(punchline.className).not.toContain("visible");

    // Advance past PUNCHLINE_DELAY (3000ms)
    act(() => vi.advanceTimersByTime(3100));

    expect(punchline.className).toContain("visible");
  });

  it("rotates to next joke after interval", () => {
    render(<ConnectingScreen />);
    // First joke visible
    expect(
      screen.getByText("Why do programmers prefer dark mode?")
    ).toBeInTheDocument();

    // Advance past ROTATE_INTERVAL (8000ms)
    act(() => vi.advanceTimersByTime(8100));

    // Second joke should now be visible
    expect(
      screen.getByText("What's a computer's favorite snack?")
    ).toBeInTheDocument();
  });

  it("shows joke counter", () => {
    render(<ConnectingScreen />);
    expect(screen.getByText(/1 \/ 8/)).toBeInTheDocument();
  });
});

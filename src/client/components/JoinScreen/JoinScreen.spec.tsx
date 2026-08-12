import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JoinScreen } from "./JoinScreen";

const defaultProps = {
  connected: true,
  nameInput: "",
  sessionIdInput: "",
  mode: "classic" as const,
  onModeChange: vi.fn(),
  onNameChange: vi.fn(),
  onSessionIdChange: vi.fn(),
  onJoin: vi.fn(),
  onOpenMyPacks: vi.fn(),
};

describe("JoinScreen", () => {
  it("renders the title", () => {
    render(<JoinScreen {...defaultProps} />);
    expect(screen.getByText("SIGNAL DECAY")).toBeInTheDocument();
  });

  it("shows connected status when connected", () => {
    render(<JoinScreen {...defaultProps} connected={true} />);
    expect(screen.getByText("Server connected")).toBeInTheDocument();
  });

  it("shows connecting when not connected", () => {
    render(<JoinScreen {...defaultProps} connected={false} />);
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  it("disables the button when name is empty", () => {
    render(<JoinScreen {...defaultProps} nameInput="" />);
    const connectBtn = screen.getAllByRole("button").find(b => b.textContent?.includes("CONNECT"));
    expect(connectBtn).toBeDisabled();
  });

  it("enables the button when connected and name is filled", () => {
    render(<JoinScreen {...defaultProps} nameInput="Alice" />);
    const connectBtn = screen.getAllByRole("button").find(b => b.textContent?.includes("CONNECT"));
    expect(connectBtn).not.toBeDisabled();
  });

  it("calls onJoin when button is clicked", () => {
    const onJoin = vi.fn();
    render(<JoinScreen {...defaultProps} nameInput="Alice" onJoin={onJoin} />);
    const connectBtn = screen.getAllByRole("button").find(b => b.textContent?.includes("CONNECT"))!;
    fireEvent.click(connectBtn);
    expect(onJoin).toHaveBeenCalledOnce();
  });

  it("calls onJoin when Enter is pressed in name input", () => {
    const onJoin = vi.fn();
    render(<JoinScreen {...defaultProps} nameInput="Alice" onJoin={onJoin} />);
    const [nameInput] = screen.getAllByRole("textbox");
    fireEvent.keyDown(nameInput, { key: "Enter" });
    expect(onJoin).toHaveBeenCalledOnce();
  });

  it("calls onNameChange when typing in name field", () => {
    const onNameChange = vi.fn();
    render(<JoinScreen {...defaultProps} onNameChange={onNameChange} />);
    const [nameInput] = screen.getAllByRole("textbox");
    fireEvent.change(nameInput, { target: { value: "Bob" } });
    expect(onNameChange).toHaveBeenCalledWith("Bob");
  });
});

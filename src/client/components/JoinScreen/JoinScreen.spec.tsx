import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JoinScreen } from "./JoinScreen";

const defaultProps = {
  connected: true,
  nameInput: "",
  sessionIdInput: "",
  onNameChange: vi.fn(),
  onSessionIdChange: vi.fn(),
  onJoin: vi.fn(),
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
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("enables the button when connected and name is filled", () => {
    render(<JoinScreen {...defaultProps} nameInput="Alice" />);
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("calls onJoin when button is clicked", () => {
    const onJoin = vi.fn();
    render(<JoinScreen {...defaultProps} nameInput="Alice" onJoin={onJoin} />);
    fireEvent.click(screen.getByRole("button"));
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

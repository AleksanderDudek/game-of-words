import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServerSelectScreen } from "./ServerSelectScreen";
import type { GameServerEntry } from "@/shared/types";

const servers: GameServerEntry[] = [
  { id: "us-east", name: "US East", region: "Virginia", url: "ws://localhost:8080", flag: "🇺🇸" },
  { id: "eu-west", name: "Europe", region: "London", url: "ws://localhost:8081", flag: "🇬🇧" },
];

describe("ServerSelectScreen", () => {
  it("renders all servers", () => {
    render(<ServerSelectScreen servers={servers} onSelect={() => {}} />);
    expect(screen.getByText("US East")).toBeInTheDocument();
    expect(screen.getByText("Europe")).toBeInTheDocument();
  });

  it("renders the title", () => {
    render(<ServerSelectScreen servers={servers} onSelect={() => {}} />);
    expect(screen.getByText(/SIGNAL DECAY/)).toBeInTheDocument();
  });

  it("renders region labels", () => {
    render(<ServerSelectScreen servers={servers} onSelect={() => {}} />);
    expect(screen.getByText("Virginia")).toBeInTheDocument();
    expect(screen.getByText("London")).toBeInTheDocument();
  });

  it("renders flag emojis", () => {
    render(<ServerSelectScreen servers={servers} onSelect={() => {}} />);
    expect(screen.getByText("🇺🇸")).toBeInTheDocument();
    expect(screen.getByText("🇬🇧")).toBeInTheDocument();
  });

  it("shows pinging state initially", () => {
    render(<ServerSelectScreen servers={servers} onSelect={() => {}} />);
    const pinging = screen.getAllByText("pinging...");
    expect(pinging.length).toBe(servers.length);
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeamScoreboard } from "./TeamScoreboard";
import type { Player, PlayerId, TeamState } from "@/shared/types";

const teams: TeamState[] = [
  { id: "alpha", score: 320, solved: 3 },
  { id: "bravo", score: 180, solved: 2 },
];

const players: Player[] = [
  { id: "p1" as PlayerId, name: "Ana", score: 200, isConnected: true, team: "alpha" },
  { id: "p2" as PlayerId, name: "Bo", score: 180, isConnected: true, team: "bravo" },
  { id: "p3" as PlayerId, name: "Cy", score: 120, isConnected: true, team: "alpha" },
];

describe("TeamScoreboard", () => {
  it("shows both squads with their scores", () => {
    render(<TeamScoreboard teams={teams} players={players} />);
    expect(screen.getByText("ALPHA")).toBeInTheDocument();
    expect(screen.getByText("320")).toBeInTheDocument();
    expect(screen.getByText("BRAVO")).toBeInTheDocument();
    expect(screen.getByText("180")).toBeInTheDocument();
  });

  it("counts squad members and solves", () => {
    render(<TeamScoreboard teams={teams} players={players} />);
    expect(screen.getByText("3 solved · 2 players")).toBeInTheDocument();
    expect(screen.getByText("2 solved · 1 player")).toBeInTheDocument();
  });

  it("names the squad on the word during an attack", () => {
    render(<TeamScoreboard teams={teams} players={players} attackingTeam="alpha" phase="attack" />);
    expect(screen.getByText("ALPHA is on the word")).toBeInTheDocument();
  });

  it("calls out the steal window instead", () => {
    render(<TeamScoreboard teams={teams} players={players} attackingTeam="bravo" phase="steal" />);
    expect(screen.getByText(/STEAL — BRAVO has one guess/)).toBeInTheDocument();
  });

  it("tags the viewer's own squad", () => {
    render(<TeamScoreboard teams={teams} players={players} myTeam="bravo" />);
    expect(screen.getByText("YOU")).toBeInTheDocument();
  });

  it("omits the banner when no squad holds the word", () => {
    render(<TeamScoreboard teams={teams} players={players} />);
    expect(screen.queryByText(/is on the word/)).not.toBeInTheDocument();
  });
});

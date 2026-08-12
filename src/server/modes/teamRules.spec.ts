import { describe, it, expect } from "vitest";
import {
  otherTeam,
  membersOf,
  pickTeamForJoin,
  nextTeamMember,
  stealPoints,
  teamsAreReady,
  leadingTeam,
} from "./teamRules";
import type { Player, PlayerId } from "../../shared/types";

function player(id: string, team?: "alpha" | "bravo"): Player {
  return { id: id as PlayerId, name: id, score: 0, isConnected: true, team };
}

describe("otherTeam", () => {
  it("flips between the two squads", () => {
    expect(otherTeam("alpha")).toBe("bravo");
    expect(otherTeam("bravo")).toBe("alpha");
  });
});

describe("pickTeamForJoin", () => {
  it("seats the first player in alpha", () => {
    expect(pickTeamForJoin([])).toBe("alpha");
  });

  it("balances by sending the next player to the smaller squad", () => {
    expect(pickTeamForJoin([player("a", "alpha")])).toBe("bravo");
    expect(pickTeamForJoin([player("a", "alpha"), player("b", "bravo")])).toBe("alpha");
    expect(
      pickTeamForJoin([player("a", "alpha"), player("b", "bravo"), player("c", "bravo")]),
    ).toBe("alpha");
  });

  it("ignores players with no squad yet", () => {
    expect(pickTeamForJoin([player("a"), player("b")])).toBe("alpha");
  });
});

describe("membersOf", () => {
  it("keeps join order within a squad", () => {
    const roster = [player("a", "alpha"), player("b", "bravo"), player("c", "alpha")];
    expect(membersOf(roster, "alpha").map((p) => p.id)).toEqual(["a", "c"]);
  });
});

describe("nextTeamMember", () => {
  const squad = [player("a", "alpha"), player("b", "alpha"), player("c", "alpha")];

  it("rotates to the next member", () => {
    expect(nextTeamMember(squad, "a" as PlayerId)).toBe("b");
    expect(nextTeamMember(squad, "c" as PlayerId)).toBe("a");
  });

  it("falls back to the first member when the holder has left", () => {
    expect(nextTeamMember(squad, "gone" as PlayerId)).toBe("a");
    expect(nextTeamMember(squad, "")).toBe("a");
  });

  it("returns null for an empty squad", () => {
    expect(nextTeamMember([], "a" as PlayerId)).toBeNull();
  });

  it("keeps handing the mic to the lone member of a one-player squad", () => {
    expect(nextTeamMember([player("a", "alpha")], "a" as PlayerId)).toBe("a");
  });
});

describe("stealPoints", () => {
  it("awards the configured fraction of the full value", () => {
    expect(stealPoints(100, 60)).toBe(60);
    expect(stealPoints(113, 60)).toBe(68);
  });

  it("never awards less than a single point", () => {
    expect(stealPoints(1, 10)).toBe(1);
  });
});

describe("teamsAreReady", () => {
  it("requires a player in both squads", () => {
    expect(teamsAreReady([player("a", "alpha"), player("b", "bravo")])).toBe(true);
    expect(teamsAreReady([player("a", "alpha"), player("b", "alpha")])).toBe(false);
    expect(teamsAreReady([])).toBe(false);
  });
});

describe("leadingTeam", () => {
  it("reports the higher score, or null on a tie", () => {
    expect(leadingTeam({ alpha: 300, bravo: 120 })).toBe("alpha");
    expect(leadingTeam({ alpha: 100, bravo: 240 })).toBe("bravo");
    expect(leadingTeam({ alpha: 90, bravo: 90 })).toBeNull();
  });
});

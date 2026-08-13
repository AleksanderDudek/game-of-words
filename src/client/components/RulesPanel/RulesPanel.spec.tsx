import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RulesPanel } from "./RulesPanel";
import type { CustomRules, GameConfig } from "@/shared/types";
import { RULE_BOUNDS } from "@/shared/rules";

const config: GameConfig = {
  pointsPerCorrect: 100,
  hintCostPoints: 30,
  turnsPerPlayer: 3,
  sessionDurationSec: 45,
  minWordLength: 4,
  maxWordLength: 20,
  coopLives: 3,
  stealSeconds: 15,
  stealPointsPct: 60,
  wordsPerDifficulty: 2,
  lobbyCountdownSec: 5,
  wordCount: 34,
};

function setup(overrides: Partial<React.ComponentProps<typeof RulesPanel>> = {}) {
  const onChange = vi.fn();
  render(
    <RulesPanel
      mode="classic"
      config={config}
      rules={undefined}
      packWordCount={0}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { onChange };
}

describe("RulesPanel — off by default", () => {
  it("starts switched off, with no controls in sight", () => {
    setup();
    expect(screen.getByRole("button", { name: /custom rules/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText(/target length/i)).not.toBeInTheDocument();
  });

  it("explains that the room is on the server defaults", () => {
    setup();
    expect(screen.getByText(/server defaults/i)).toBeInTheDocument();
  });

  it("seeds the word count from the server's own length when switched on", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /custom rules/i }));
    expect(onChange).toHaveBeenCalledWith({ wordGoal: 34 });
  });

  it("hands the room back to the defaults when switched off", () => {
    const { onChange } = setup({ rules: { wordGoal: 12 } });
    fireEvent.click(screen.getByRole("button", { name: /custom rules/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe("RulesPanel — controls", () => {
  const rules: CustomRules = { wordGoal: 20, roundSeconds: 45, guessesPerTurn: 3 };

  it("steps the word count and keeps the other rules intact", () => {
    const { onChange } = setup({ rules });
    fireEvent.click(screen.getByRole("button", { name: /words in the game \+5/i }));
    expect(onChange).toHaveBeenCalledWith({ ...rules, wordGoal: 25 });
  });

  it("steps the round clock", () => {
    const { onChange } = setup({ rules });
    fireEvent.click(screen.getByRole("button", { name: /time per word \+15/i }));
    expect(onChange).toHaveBeenCalledWith({ ...rules, roundSeconds: 60 });
  });

  it("clamps a step at the bound instead of running past it", () => {
    const { onChange } = setup({ rules: { ...rules, roundSeconds: RULE_BOUNDS.roundSeconds.max - 5 } });
    fireEvent.click(screen.getByRole("button", { name: /time per word \+15/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ roundSeconds: RULE_BOUNDS.roundSeconds.max }),
    );
  });

  it("offers lives in coop and nowhere else", () => {
    const { unmount } = render(
      <RulesPanel mode="coop" config={config} rules={rules} packWordCount={0} onChange={vi.fn()} />,
    );
    expect(screen.getByText(/lives/i)).toBeInTheDocument();
    unmount();

    setup({ rules });
    expect(screen.queryByText(/lives/i)).not.toBeInTheDocument();
  });

  it("locks every control for a player who is not the host", () => {
    setup({ rules, disabled: true });
    expect(screen.getByRole("button", { name: /custom rules/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /words in the game \+1/i })).toBeDisabled();
  });

  it("offers to take the word count straight from the selected packs", () => {
    const { onChange } = setup({ rules, packWordCount: 48 });
    fireEvent.click(screen.getByRole("button", { name: /use all 48 words/i }));
    expect(onChange).toHaveBeenCalledWith({ ...rules, wordGoal: 48 });
  });
});

describe("RulesPanel — length feedback", () => {
  it("shows an estimate as soon as the panel is on", () => {
    setup({ rules: { wordGoal: 20, roundSeconds: 45 } });
    expect(screen.getByText(/≈ \d+ min/)).toBeInTheDocument();
  });

  it("picking a target length fills in a word count that fits it", () => {
    const { onChange } = setup({ rules: { wordGoal: 20, roundSeconds: 45 } });
    fireEvent.click(screen.getByRole("button", { name: /20–30 min/i }));

    const sent = onChange.mock.calls[0][0] as CustomRules;
    expect(sent.targetBand).toBe("20-30");
    expect(sent.wordGoal).toBeGreaterThan(20);
  });

  it("confirms a selection that lands inside the target", () => {
    setup({ rules: { targetBand: "20-30", wordGoal: 44, roundSeconds: 45 } });
    expect(screen.getByText(/fits the 20–30 min target/i)).toBeInTheDocument();
  });

  it("warns — with a suggestion — when the selection is too short", () => {
    setup({ rules: { targetBand: "45-60", wordGoal: 5, roundSeconds: 45 } });
    expect(screen.getByText(/shorter than 45–60 min/i)).toBeInTheDocument();
    expect(screen.getByText(/try \d+ words/i)).toBeInTheDocument();
  });

  it("warns when the selection overruns the target", () => {
    setup({ rules: { targetBand: "5-15", wordGoal: 120, roundSeconds: 60 } });
    expect(screen.getByText(/longer than 5–15 min/i)).toBeInTheDocument();
  });

  it("flags a word goal the selected packs cannot cover without repeats", () => {
    setup({ rules: { wordGoal: 60 }, packWordCount: 40 });
    expect(screen.getByText(/only 40 words selected/i)).toBeInTheDocument();
  });

  it("stays quiet about repeats when the packs cover the goal", () => {
    setup({ rules: { wordGoal: 20 }, packWordCount: 40 });
    expect(screen.queryByText(/come round twice/i)).not.toBeInTheDocument();
  });
});

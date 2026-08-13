import type { CustomRules, GameConfig, GameMode } from "@/shared/types";

export interface RulesPanelProps {
  mode: GameMode;
  /** Effective config from the server — the fallback for every unset rule. */
  config: GameConfig;
  /** The host's current overrides, or undefined while none are set. */
  rules: CustomRules | undefined;
  /** Words available across the selected packs; 0 for the default word bank. */
  packWordCount: number;
  /** Non-hosts see the same readout but cannot change anything. */
  disabled?: boolean;
  /** Push the whole rule set; null turns customisation back off. */
  onChange: (rules: CustomRules | null) => void;
}

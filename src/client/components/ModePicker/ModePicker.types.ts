import type { GameMode } from "@/shared/types";

export interface ModePickerProps {
  value: GameMode;
  onChange: (mode: GameMode) => void;
  /** Renders read-only (non-hosts see the host's choice) */
  disabled?: boolean;
  /** Modes that cannot currently be picked, with a reason shown as a tooltip */
  lockedModes?: Partial<Record<GameMode, string>>;
  compact?: boolean;
}

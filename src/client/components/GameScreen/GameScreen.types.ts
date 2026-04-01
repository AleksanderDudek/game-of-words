import type { SessionSnapshot, ServerMessage } from "@/shared/types";

export interface GameScreenProps {
  session: SessionSnapshot;
  playerId: string | null;
  events: ServerMessage[];
  guessInput: string;
  onGuessChange: (value: string) => void;
  onGuess: () => void;
  onBuyHint: () => void;
  onPassTurn?: () => void;
  onPauseGame?: () => void;
  onResumeGame?: () => void;
  onForfeitGame?: () => void;
  isHost?: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
}

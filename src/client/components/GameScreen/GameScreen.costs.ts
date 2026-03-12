import type { SessionSnapshot, ServerMessage } from "@/shared/types";

export interface GameScreenProps {
  session: SessionSnapshot;
  playerId: string | null;
  events: ServerMessage[];
  guessInput: string;
  onGuessChange: (value: string) => void;
  onGuess: () => void;
  onBuyHint: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}

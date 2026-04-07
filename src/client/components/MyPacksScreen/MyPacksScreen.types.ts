import type { WordPack } from "@/client/lib/wordPack";

export interface MyPacksScreenProps {
  onClose: () => void;
  /** When opened from the lobby: called when user picks a pack to use in game. */
  onSelectPack?: (pack: WordPack) => void;
  selectedPackId?: string;
}

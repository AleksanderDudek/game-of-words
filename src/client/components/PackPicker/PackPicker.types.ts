import type { BuiltinPackInfo, PackReference } from "@/shared/types";
import type { WordPack } from "@/client/lib/wordPack";

export interface PackPickerProps {
  /** Server-provided built-in packs. */
  builtinPacks: BuiltinPackInfo[];
  /** Locally-stored custom packs (IndexedDB / Drive). */
  localPacks: WordPack[];
  /** Name of the currently active pack, or null for the default word bank. */
  activePackName: string | null;
  /** Dispatch a pack selection (builtin / custom / clear). */
  onSelect: (ref: PackReference) => void;
  /** Open the "My Packs" management screen. */
  onManagePacks: () => void;
}

export type SortKey = "name" | "difficulty" | "words";

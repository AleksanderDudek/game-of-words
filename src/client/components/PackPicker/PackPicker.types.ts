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
  /**
   * Let the host stack several packs into one pool. Off by default, which
   * keeps the original single-select behaviour.
   */
  multiSelect?: boolean;
  /**
   * Server-side keys of the packs currently selected ("builtin:<id>" /
   * "custom:<name>"). Only read in multi-select mode.
   */
  selectedKeys?: string[];
  /** Multi-select only: replace the whole selection. */
  onSelectMany?: (refs: PackReference[]) => void;
}

export type SortKey = "name" | "difficulty" | "words";

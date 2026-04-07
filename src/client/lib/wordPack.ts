import type { WordPackEntry } from "@/shared/types";

/** A word pack stored in the client (IndexedDB or Google Drive). */
export interface WordPack {
  id: string;
  name: string;
  description?: string;
  words: WordPackEntry[];
  createdAt: number;
  lastUsedAt?: number;
  source: "local" | "drive";
  driveFileId?: string;
}

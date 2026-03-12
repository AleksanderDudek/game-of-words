// ═══════════════════════════════════════════════════════════════
// Board Logic — Shuffle middle letters, reveal pairs
// ═══════════════════════════════════════════════════════════════

import { LetterCell } from "./types";

// Characters that stay fixed (special chars, first, last)
const SPECIAL_CHARS = new Set(["-", "'", " ", ".", ","]);

/**
 * Build the initial board from a word.
 * First and last characters are fixed. Special chars are fixed.
 * Middle letters get shuffled in pairs (no identical-letter swaps).
 */
export function buildBoard(word: string): LetterCell[] {
  const cells: LetterCell[] = word.split("").map((ch, i) => ({
    index: i,
    original: ch,
    current: ch,
    isFixed: i === 0 || i === word.length - 1 || SPECIAL_CHARS.has(ch),
    isRevealed: false,
    swappedWith: null,
  }));

  // Collect shuffleable indices (middle, non-special, non-fixed)
  const shuffleable = cells
    .filter((c) => !c.isFixed)
    .map((c) => c.index);

  if (shuffleable.length < 2) return cells; // too short to shuffle

  // Shuffle by swapping pairs — each pair must be different letters
  const available = [...shuffleable];
  const swaps: [number, number][] = [];

  // Shuffle the available list first for randomness
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }

  // Pick pairs to swap
  const used = new Set<number>();
  for (let i = 0; i < available.length - 1; i++) {
    const a = available[i];
    const b = available[i + 1];
    if (used.has(a) || used.has(b)) continue;

    // Don't swap identical letters (rule: exchanged pairs can't be same)
    if (cells[a].original === cells[b].original) continue;

    swaps.push([a, b]);
    used.add(a);
    used.add(b);
    i++; // skip next since we used it
  }

  // If we couldn't make any swaps (e.g., all same letter), try harder
  if (swaps.length === 0 && shuffleable.length >= 2) {
    // Force at least one swap even if suboptimal
    for (let i = 0; i < shuffleable.length; i++) {
      for (let j = i + 1; j < shuffleable.length; j++) {
        if (cells[shuffleable[i]].original !== cells[shuffleable[j]].original) {
          swaps.push([shuffleable[i], shuffleable[j]]);
          break;
        }
      }
      if (swaps.length > 0) break;
    }
  }

  // Apply swaps
  for (const [a, b] of swaps) {
    cells[a].current = cells[b].original;
    cells[b].current = cells[a].original;
    cells[a].swappedWith = b;
    cells[b].swappedWith = a;
  }

  return cells;
}

/**
 * Reveal one swapped pair on the board. Returns the pair indices or null if none left.
 */
export function revealNextPair(board: LetterCell[]): [number, number] | null {
  for (const cell of board) {
    if (
      !cell.isFixed &&
      !cell.isRevealed &&
      cell.swappedWith !== null &&
      cell.current !== cell.original
    ) {
      const partner = cell.swappedWith;

      // Restore both to original
      board[cell.index].current = board[cell.index].original;
      board[cell.index].isRevealed = true;
      board[partner].current = board[partner].original;
      board[partner].isRevealed = true;

      return [cell.index, partner];
    }
  }
  return null; // no more pairs to reveal
}

/**
 * Get the current displayed string from the board.
 */
export function boardToString(board: LetterCell[]): string {
  return board.map((c) => c.current).join("");
}

/**
 * Check if a guess matches the original word.
 */
export function checkGuess(board: LetterCell[], guess: string): boolean {
  const original = board.map((c) => c.original).join("");
  return guess.toLowerCase() === original.toLowerCase();
}

/**
 * Count remaining unrevealed swapped pairs.
 */
export function remainingPairs(board: LetterCell[]): number {
  let count = 0;
  const counted = new Set<number>();
  for (const cell of board) {
    if (
      !cell.isFixed &&
      !cell.isRevealed &&
      cell.swappedWith !== null &&
      cell.current !== cell.original &&
      !counted.has(cell.index)
    ) {
      counted.add(cell.index);
      counted.add(cell.swappedWith);
      count++;
    }
  }
  return count;
}

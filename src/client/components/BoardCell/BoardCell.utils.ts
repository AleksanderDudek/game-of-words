import type { LetterCell } from "@/shared/types";

export function getBoardCellClassName(cell: LetterCell): string {
  const classes = [
    "board-cell",
    cell.isFixed ? "fixed" : "",
    cell.isRevealed ? "revealed" : "",
    !cell.isFixed && !cell.isRevealed && cell.swappedWith !== null ? "swapped" : "",
  ];
  return classes.filter(Boolean).join(" ");
}

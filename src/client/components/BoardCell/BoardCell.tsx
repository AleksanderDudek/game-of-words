import styles from "./BoardCell.module.scss";
import { getBoardCellClassName } from "./BoardCell.utils";
import type { BoardCellProps } from "./BoardCell.types";

export function BoardCell({ cell, index }: BoardCellProps) {
  const cls = getBoardCellClassName(cell)
    .split(" ")
    .map((c) => styles[c] ?? c)
    .join(" ");

  return (
    <div className={cls} style={{ animationDelay: `${index * 40}ms` }}>
      <span className={styles["cell-char"]}>{cell.current}</span>
      <span className={styles["cell-index"]}>{index}</span>
    </div>
  );
}

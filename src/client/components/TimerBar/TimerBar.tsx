import styles from "./TimerBar.module.scss";
import { getTimerPercent, isUrgent, formatTime } from "./TimerBar.utils";
import type { TimerBarProps } from "./TimerBar.utils";

export function TimerBar({ timeLeft, total }: TimerBarProps) {
  const pct = getTimerPercent(timeLeft, total);
  const urgent = isUrgent(pct);

  return (
    <div className={styles["timer-bar-track"]}>
      <div
        className={`${styles["timer-bar-fill"]}${urgent ? ` ${styles["urgent"]}` : ""}`}
        style={{ width: `${pct}%` }}
      />
      <span className={styles["timer-bar-text"]}>{formatTime(timeLeft)}</span>
    </div>
  );
}

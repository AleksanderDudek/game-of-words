import { useTranslation } from "react-i18next";
import styles from "./CoopStatus.module.scss";
import type { CoopStatusProps } from "./CoopStatus.types";

/**
 * The three shared resources a co-op table is actually managing: lives left in
 * the run, the bank hints are paid from, and the guesses left on this word.
 */
export function CoopStatus({ coop }: CoopStatusProps) {
  const { t } = useTranslation();
  const lives = Array.from({ length: coop.maxLives }, (_, i) => i < coop.livesLeft);
  const low = coop.guessesLeft <= 1;

  return (
    <div className={styles["coop-status"]}>
      <div className={styles["stat"]}>
        <span className={styles["stat-label"]}>{t("coop.lives")}</span>
        <span className={styles["lives"]} aria-label={t("coop.livesLeft", { count: coop.livesLeft })}>
          {lives.map((alive, i) => (
            <span key={i} className={alive ? styles["life"] : styles["life-lost"]} aria-hidden="true">
              {alive ? "◆" : "◇"}
            </span>
          ))}
        </span>
      </div>

      <div className={styles["stat"]}>
        <span className={styles["stat-label"]}>{t("coop.bank")}</span>
        <span className={styles["stat-value"]}>{coop.bank}</span>
      </div>

      <div className={styles["stat"]}>
        <span className={styles["stat-label"]}>{t("coop.sharedGuesses")}</span>
        <span className={`${styles["stat-value"]} ${low ? styles["low"] : ""}`}>
          {coop.guessesLeft}/{coop.guessesPerRound}
        </span>
      </div>

      <div className={styles["stat"]}>
        <span className={styles["stat-label"]}>{t("coop.cleared")}</span>
        <span className={styles["stat-value"]}>{coop.roundsCleared}</span>
      </div>
    </div>
  );
}

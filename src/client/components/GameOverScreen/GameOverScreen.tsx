import { useTranslation } from "react-i18next";
import styles from "./GameOverScreen.module.scss";
import type { GameOverScreenProps } from "./GameOverScreen.types";

export function GameOverScreen({ players, playerId, onNewGame }: GameOverScreenProps) {
  const { t } = useTranslation();
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className={styles["gameover-screen"]}>
      <h1 className={styles["gameover-title"]}>{t("gameOver.title")}</h1>
      <p className={styles["gameover-subtitle"]}>{t("gameOver.subtitle")}</p>

      <div className={styles["leaderboard"]}>
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={`${styles["lb-row"]}${i === 0 ? ` ${styles["winner"]}` : ""}`}
          >
            <span className={styles["lb-rank"]}>#{i + 1}</span>
            <span className={styles["lb-name"]}>
              {p.name}
              {p.id === playerId && (
                <span className={styles["you-badge"]}>{t("common.you")}</span>
              )}
            </span>
            <span className={styles["lb-score"]}>{p.score}</span>
          </div>
        ))}
      </div>

      <button className="btn primary" onClick={onNewGame}>
        {t("gameOver.newGame")}
      </button>
    </div>
  );
}

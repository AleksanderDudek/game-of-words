import { useTranslation } from "react-i18next";
import styles from "./PlayerCard.module.scss";
import type { PlayerCardProps } from "./PlayerCard.types";

export function PlayerCard({ player, isCurrent, isYou }: PlayerCardProps) {
  const { t } = useTranslation();
  const cardClass = [
    styles["player-card"],
    isCurrent ? styles["current"] : "",
    isYou ? styles["you"] : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClass}>
      <div className={styles["player-indicator"]}>
        <div
          className={`${styles["player-dot"]} ${
            player.isConnected ? styles["online"] : styles["offline"]
          }`}
        />
        {isCurrent && <span className={styles["turn-arrow"]}>▸</span>}
      </div>
      <div className={styles["player-info"]}>
        <span className={styles["player-name"]}>
          {player.name}
          {isYou && <span className={styles["you-badge"]}>{t("common.you")}</span>}
        </span>
        <span className={styles["player-score"]}>{player.score} {t("common.pts")}</span>
      </div>
    </div>
  );
}

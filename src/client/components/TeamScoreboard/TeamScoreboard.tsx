import { useTranslation } from "react-i18next";
import styles from "./TeamScoreboard.module.scss";
import type { TeamScoreboardProps } from "./TeamScoreboard.types";

/**
 * Squad scores plus who is on the clock. During a steal the attacking squad
 * flips, so the banner spells out what is happening rather than relying on the
 * highlight alone.
 */
export function TeamScoreboard({
  teams,
  players,
  attackingTeam,
  phase,
  myTeam,
}: TeamScoreboardProps) {
  const { t } = useTranslation();
  const isSteal = phase === "steal";

  return (
    <div className={styles["team-scoreboard"]}>
      <div className={styles["score-row"]}>
        {teams.map((team) => {
          const size = players.filter((p) => p.team === team.id).length;
          const cls = [
            styles["team-score"],
            styles[team.id],
            attackingTeam === team.id ? styles["attacking"] : "",
            myTeam === team.id ? styles["mine"] : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={team.id} className={cls}>
              <span className={styles["team-label"]}>
                {t(`teams.${team.id}`)}
                {myTeam === team.id && <span className={styles["you-tag"]}>{t("common.you")}</span>}
              </span>
              <span className={styles["team-points"]}>{team.score}</span>
              <span className={styles["team-meta"]}>
                {t("teams.solvedCount", { count: team.solved })} · {t("teams.memberCount", { count: size })}
              </span>
            </div>
          );
        })}
      </div>

      {attackingTeam && (
        <div className={`${styles["phase-banner"]} ${isSteal ? styles["steal"] : ""}`}>
          {isSteal
            ? t("teams.stealBanner", { team: t(`teams.${attackingTeam}`) })
            : t("teams.attackBanner", { team: t(`teams.${attackingTeam}`) })}
        </div>
      )}
    </div>
  );
}

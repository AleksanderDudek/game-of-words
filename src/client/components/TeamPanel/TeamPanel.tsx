import { useTranslation } from "react-i18next";
import styles from "./TeamPanel.module.scss";
import { TEAM_IDS } from "@/shared/types";
import type { TeamId } from "@/shared/types";
import type { TeamPanelProps } from "./TeamPanel.types";

/** Lobby squad roster — one column per team, click to switch sides. */
export function TeamPanel({ players, playerId, hostId, onSelectTeam }: TeamPanelProps) {
  const { t } = useTranslation();
  const myTeam = players.find((p) => p.id === playerId)?.team;

  return (
    <div className={styles["team-panel"]}>
      {TEAM_IDS.map((team: TeamId) => {
        const members = players.filter((p) => p.team === team);
        const isMine = myTeam === team;

        return (
          <div key={team} className={`${styles["team-col"]} ${styles[team]}`}>
            <div className={styles["team-head"]}>
              <span className={styles["team-name"]}>{t(`teams.${team}`)}</span>
              <span className={styles["team-size"]}>{members.length}</span>
            </div>

            <ul className={styles["team-members"]}>
              {members.map((p) => (
                <li key={p.id} className={p.id === playerId ? styles["is-you"] : ""}>
                  <span className={styles["member-name"]}>{p.name}</span>
                  {p.id === hostId && <span className={styles["tag"]}>{t("lobby.hostBadge")}</span>}
                  {p.id === playerId && <span className={styles["tag"]}>{t("common.you")}</span>}
                </li>
              ))}
              {members.length === 0 && (
                <li className={styles["empty"]}>{t("teams.emptySquad")}</li>
              )}
            </ul>

            <button
              type="button"
              className={`btn ${styles["join-btn"]}`}
              onClick={() => onSelectTeam(team)}
              disabled={isMine}
            >
              {isMine ? t("teams.yourSquad") : t("teams.joinSquad")}
            </button>
          </div>
        );
      })}
    </div>
  );
}

import { useTranslation } from "react-i18next";
import styles from "./GameOverScreen.module.scss";
import { coopGrade } from "@/shared/coop";
import type { GameOverScreenProps } from "./GameOverScreen.types";

export function GameOverScreen({
  players,
  playerId,
  onNewGame,
  mode = "classic",
  teams,
  coop,
}: GameOverScreenProps) {
  const { t } = useTranslation();
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const mvp = sorted[0];

  // ─── Team result: squads first, individuals demoted to a contribution list ───
  const renderTeamResult = () => {
    if (!teams) return null;
    const [alpha, bravo] = teams;
    let winner: typeof alpha | null = null;
    if (alpha.score > bravo.score) winner = alpha;
    if (bravo.score > alpha.score) winner = bravo;

    return (
      <>
        <p className={styles["gameover-subtitle"]}>
          {winner
            ? t("results.teamWinner", { team: t(`teams.${winner.id}`) })
            : t("results.teamDraw")}
        </p>
        <div className={styles["team-result"]}>
          {teams.map((team) => (
            <div
              key={team.id}
              className={`${styles["team-block"]} ${styles[team.id]} ${
                winner?.id === team.id ? styles["winner"] : ""
              }`}
            >
              <span className={styles["team-title"]}>{t(`teams.${team.id}`)}</span>
              <span className={styles["team-total"]}>{team.score}</span>
              <span className={styles["team-sub"]}>
                {t("teams.solvedCount", { count: team.solved })}
              </span>
            </div>
          ))}
        </div>
      </>
    );
  };

  // ─── Coop result: a graded run, not a winner ───
  const renderCoopResult = () => {
    if (!coop) return null;
    const grade = coopGrade(coop.roundsCleared, coop.roundsFailed);

    return (
      <>
        <p className={styles["gameover-subtitle"]}>{t("results.coopSubtitle")}</p>
        <div className={styles["coop-result"]}>
          <span className={`${styles["grade"]} ${styles[`grade-${grade}`]}`}>{grade}</span>
          <div className={styles["coop-stats"]}>
            <span>{t("results.coopCleared", { count: coop.roundsCleared })}</span>
            <span>{t("results.coopFailed", { count: coop.roundsFailed })}</span>
            <span>{t("results.coopBank", { points: coop.bank })}</span>
          </div>
        </div>
      </>
    );
  };

  // ─── Solo result: you against the rival ───
  const renderSoloResult = () => {
    const you = players.find((p) => p.id === playerId);
    const bot = players.find((p) => p.isBot);
    if (!you || !bot) return null;

    let outcome = t("results.soloDraw");
    if (you.score > bot.score) outcome = t("results.soloWin", { name: bot.name });
    if (you.score < bot.score) outcome = t("results.soloLoss", { name: bot.name });

    return <p className={styles["gameover-subtitle"]}>{outcome}</p>;
  };

  return (
    <div className={styles["gameover-screen"]}>
      <h1 className={styles["gameover-title"]}>{t("gameOver.title")}</h1>

      {mode === "team" && renderTeamResult()}
      {mode === "coop" && renderCoopResult()}
      {mode === "solo" && renderSoloResult()}
      {mode === "classic" && <p className={styles["gameover-subtitle"]}>{t("gameOver.subtitle")}</p>}

      {mode === "team" && mvp && (
        <p className={styles["mvp-line"]}>{t("results.mvp", { name: mvp.name, points: mvp.score })}</p>
      )}

      <div className={styles["leaderboard"]}>
        <div className={styles["lb-caption"]}>
          {mode === "coop" || mode === "team"
            ? t("results.contributions")
            : t("gameOver.subtitle")}
        </div>
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={`${styles["lb-row"]}${i === 0 && mode !== "coop" ? ` ${styles["winner"]}` : ""}`}
          >
            <span className={styles["lb-rank"]}>#{i + 1}</span>
            <span className={styles["lb-name"]}>
              {p.name}
              {p.id === playerId && (
                <span className={styles["you-badge"]}>{t("common.you")}</span>
              )}
              {p.team && <span className={styles["lb-team"]}>{t(`teams.${p.team}Short`)}</span>}
              {p.isBot && <span className={styles["lb-team"]}>{t("solo.rivalBadge")}</span>}
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

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./GameScreen.module.scss";
import { BoardCell } from "../BoardCell/BoardCell";
import { TimerBar } from "../TimerBar/TimerBar";
import { PlayerCard } from "../PlayerCard/PlayerCard";
import { EventLog } from "../EventLog/EventLog";
import { TeamScoreboard } from "../TeamScoreboard/TeamScoreboard";
import { CoopStatus } from "../CoopStatus/CoopStatus";
import { modeMeta } from "@/client/lib/modes";
import type { GameScreenProps } from "./GameScreen.types";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

export function GameScreen({
  session,
  playerId,
  events,
  guessInput,
  onGuessChange,
  onGuess,
  onBuyHint,
  onPassTurn,
  onPauseGame,
  onResumeGame,
  onForfeitGame,
  inputRef,
}: GameScreenProps) {
  const { t } = useTranslation();
  const round = session.round!;
  const mode = session.mode;
  const isMyTurn = round.currentPlayerId === playerId;
  const me = session.players.find((p) => p.id === playerId);
  const currentPlayer = session.players.find((p) => p.id === round.currentPlayerId);

  // Hints are paid from a different pot in every mode: your own points in
  // classic/solo, the squad's in team, the table's shared bank in coop.
  const myTeamScore = session.teams?.find((tm) => tm.id === me?.team)?.score ?? 0;
  let hintBank = me?.score ?? 0;
  if (mode === "team") hintBank = myTeamScore;
  if (mode === "coop") hintBank = session.coop?.bank ?? 0;
  const onAttackingSquad = mode !== "team" || me?.team === round.attackingTeam;
  const canAffordHint = hintBank >= session.config.hintCostPoints && onAttackingSquad;

  const [shake, setShake] = useState(false);
  const prevEventsLen = useRef(events.length);

  useEffect(() => {
    if (events.length > prevEventsLen.current) {
      const last = events[events.length - 1];
      if (last?.type === "guess_result" && last.playerId === playerId) {
        if (last.correct) {
          Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
        } else {
          setShake(true);
          setTimeout(() => setShake(false), 500);
          Haptics.notification({ type: NotificationType.Error }).catch(() => {});
        }
      }
    }
    prevEventsLen.current = events.length;
  }, [events, playerId]);

  // Team games read better with squadmates grouped rather than in join order.
  const rosterOrder =
    mode === "team"
      ? [...session.players].sort((a, b) => (a.team ?? "").localeCompare(b.team ?? ""))
      : session.players;

  const turnIndicatorClass = [
    styles["turn-indicator"],
    isMyTurn ? styles["your-turn"] : "",
  ]
    .filter(Boolean)
    .join(" ");

  /**
   * Whose move it is, phrased for the mode: a personal guess budget in
   * classic/solo, a shared pool in team/coop, and a "thinking" state while the
   * solo rival works.
   */
  const renderTurnStatus = () => {
    if (session.state === "paused") {
      return <span className={styles["paused-text"]}>{t("game.paused")}</span>;
    }
    if (session.state === "round_end") {
      return <span className={styles["round-end-msg"]}>{t("game.roundEnd")}</span>;
    }
    if (mode === "solo" && currentPlayer?.isBot) {
      return (
        <span className={styles["turn-text"]}>
          {round.botThinking
            ? t("solo.rivalThinking", { name: currentPlayer.name })
            : t("game.theirTurn", { name: currentPlayer.name })}
        </span>
      );
    }
    if (isMyTurn) {
      return (
        <>
          <span className={styles["turn-text"]}>{t("game.yourTurn")}</span>
          <span className={styles["turns-left"]}>
            {mode === "coop" || mode === "team"
              ? t("game.sharedGuessesLeft", { count: round.turnsRemaining })
              : t("game.guessesLeft", { count: round.turnsRemaining })}
          </span>
        </>
      );
    }
    return (
      <span className={styles["turn-text"]}>
        {t("game.theirTurn", { name: currentPlayer?.name })}
      </span>
    );
  };

  return (
    <div className={styles["game-screen"]}>
      <div className={styles["game-topbar"]}>
        <div className={styles["session-badge"]}>
          <span className={styles["session-label"]}>{t("game.session")}</span>
          <span className={styles["session-code"]}>{session.sessionId}</span>
        </div>
        <div className={styles["round-badge"]}>
          <span className={styles["mode-tag"]} title={t(`modes.${mode}.name`)}>
            {modeMeta(mode).icon}
          </span>
          {t("game.round")} {round.roundNumber}
          <span className={styles["difficulty-tag"]}>{round.wordLength} {t("common.letters")}</span>
        </div>
      </div>

      {mode === "team" && session.teams && (
        <TeamScoreboard
          teams={session.teams}
          players={session.players}
          attackingTeam={round.attackingTeam}
          phase={round.phase}
          myTeam={me?.team}
        />
      )}

      {mode === "coop" && session.coop && <CoopStatus coop={session.coop} />}

      <TimerBar
        timeLeft={round.timeLeft}
        total={round.phase === "steal"
          ? session.config.stealSeconds ?? session.config.sessionDurationSec
          : session.config.sessionDurationSec}
      />

      <div className={styles["hint-box"]}>
        <span className={styles["hint-label"]}>{t("game.hint")}</span>
        <span className={styles["hint-text"]}>{round.hint}</span>
      </div>

      <div className={styles["board"]}>
        {round.board.map((cell, i) => (
          <BoardCell key={i} cell={cell} index={i} />
        ))}
      </div>

      <div className={turnIndicatorClass}>{renderTurnStatus()}</div>

      {session.state === "playing" && (
        <div className={styles["guess-area"]}>
          <div className={styles["guess-input-row"]}>
            <div className={styles["guess-input-wrap"]}>
              <input
                ref={inputRef}
                type="text"
                value={guessInput}
                onChange={(e) => onGuessChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onGuess()}
                placeholder={isMyTurn ? t("game.guessPlaceholder") : t("game.waitingPlaceholder")}
                disabled={!isMyTurn}
                className={`${styles["guess-input"]} ${shake ? styles["shake"] : ""}`}
              />
              {isMyTurn && (
                <span className={`${styles["guess-len"]} ${
                  guessInput.length === round.wordLength ? styles["exact"] :
                  guessInput.length > round.wordLength ? styles["over"] : ""
                }`}>
                  {guessInput.length}/{round.wordLength}
                </span>
              )}
            </div>
            <button
              className={`btn primary ${styles["guess-btn"]}`}
              onClick={onGuess}
              disabled={!isMyTurn || !guessInput.trim()}
            >
              GUESS
            </button>
          </div>
          <button
            className={`btn ${styles["hint-btn"]}`}
            onClick={onBuyHint}
            disabled={!canAffordHint}
            title={t("game.revealPairTitle", {
              cost: session.config.hintCostPoints,
              bank: hintBank,
              source: t(`game.bank.${mode}`),
            })}
          >
            {t("game.revealPair", { cost: session.config.hintCostPoints })}
            <span className={styles["hint-bank"]}>
              {t(`game.bank.${mode}`)}: {hintBank}
            </span>
          </button>
        </div>
      )}

      {(session.state === "playing" || session.state === "paused") && (
        <div className={styles["action-bar"]}>
          {session.state === "playing" && isMyTurn && onPassTurn && (
            <button className="btn" onClick={onPassTurn} title={t("game.passTurnTitle")}>
              {mode === "team" || mode === "coop" ? t("game.passMic") : t("game.passTurn")}
            </button>
          )}
          {session.state === "playing" && onPauseGame && (
            <button className="btn" onClick={onPauseGame}>
              {t("game.pause")}
            </button>
          )}
          {session.state === "paused" && onResumeGame && (
            <button className="btn primary" onClick={onResumeGame}>
              {t("game.resume")}
            </button>
          )}
          {onForfeitGame && (
            <button className={`btn ${styles["forfeit-btn"]}`} onClick={onForfeitGame}>
              {t("game.leaveGame")}
            </button>
          )}
        </div>
      )}

      <div className={styles["bottom-panel"]}>
        <div className={styles["players-panel"]}>
          {rosterOrder.map((p) => (
            <PlayerCard
              key={p.id}
              player={p}
              isCurrent={p.id === round.currentPlayerId}
              isYou={p.id === playerId}
            />
          ))}
        </div>
        <EventLog events={events} players={session.players} />
      </div>
    </div>
  );
}

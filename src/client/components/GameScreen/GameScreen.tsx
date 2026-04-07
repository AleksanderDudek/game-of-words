import { useTranslation } from "react-i18next";
import styles from "./GameScreen.module.scss";
import { BoardCell } from "../BoardCell/BoardCell";
import { TimerBar } from "../TimerBar/TimerBar";
import { PlayerCard } from "../PlayerCard/PlayerCard";
import { EventLog } from "../EventLog/EventLog";
import type { GameScreenProps } from "./GameScreen.types";

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
  const isMyTurn = round.currentPlayerId === playerId;
  const me = session.players.find((p) => p.id === playerId);
  const canAffordHint = (me?.score ?? 0) >= session.config.hintCostPoints;

  const turnIndicatorClass = [
    styles["turn-indicator"],
    isMyTurn ? styles["your-turn"] : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles["game-screen"]}>
      <div className={styles["game-topbar"]}>
        <div className={styles["session-badge"]}>
          <span className={styles["session-label"]}>{t("game.session")}</span>
          <span className={styles["session-code"]}>{session.sessionId}</span>
        </div>
        <div className={styles["round-badge"]}>
          {t("game.round")} {round.roundNumber}
          <span className={styles["difficulty-tag"]}>{round.wordLength} {t("common.letters")}</span>
        </div>
      </div>

      <TimerBar timeLeft={round.timeLeft} total={session.config.sessionDurationSec} />

      <div className={styles["hint-box"]}>
        <span className={styles["hint-label"]}>{t("game.hint")}</span>
        <span className={styles["hint-text"]}>{round.hint}</span>
      </div>

      <div className={styles["board"]}>
        {round.board.map((cell, i) => (
          <BoardCell key={i} cell={cell} index={i} />
        ))}
      </div>

      <div className={turnIndicatorClass}>
        {session.state === "paused" ? (
          <span className={styles["paused-text"]}>{t("game.paused")}</span>
        ) : session.state === "round_end" ? (
          <span className={styles["round-end-msg"]}>{t("game.roundEnd")}</span>
        ) : isMyTurn ? (
          <>
            <span className={styles["turn-text"]}>{t("game.yourTurn")}</span>
            <span className={styles["turns-left"]}>
              {t("game.guessesLeft", { count: round.turnsRemaining })}
            </span>
          </>
        ) : (
          <span className={styles["turn-text"]}>
            {t("game.theirTurn", { name: session.players.find((p) => p.id === round.currentPlayerId)?.name })}
          </span>
        )}
      </div>

      {session.state === "playing" && (
        <div className={styles["guess-area"]}>
          <div className={styles["guess-input-row"]}>
            <input
              ref={inputRef}
              type="text"
              value={guessInput}
              onChange={(e) => onGuessChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onGuess()}
              placeholder={isMyTurn ? t("game.guessPlaceholder") : t("game.waitingPlaceholder")}
              disabled={!isMyTurn}
              className={styles["guess-input"]}
            />
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
            title={`Costs ${session.config.hintCostPoints} points`}
          >
            {t("game.revealPair", { cost: session.config.hintCostPoints })}
          </button>
        </div>
      )}

      {(session.state === "playing" || session.state === "paused") && (
        <div className={styles["action-bar"]}>
          {session.state === "playing" && isMyTurn && onPassTurn && (
            <button className="btn" onClick={onPassTurn}>
              {t("game.passTurn")}
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
          {session.players.map((p) => (
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

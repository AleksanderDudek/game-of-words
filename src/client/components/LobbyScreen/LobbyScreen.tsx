import styles from "./LobbyScreen.module.scss";
import { PlayerCard } from "../PlayerCard/PlayerCard";
import type { LobbyScreenProps } from "./LobbyScreen.costs";

export function LobbyScreen({ session, playerId, onStartGame }: LobbyScreenProps) {
  const canStart = session.players.length >= 2;

  return (
    <div className={styles["lobby-screen"]}>
      <div className={styles["session-header"]}>
        <span className={styles["session-label"]}>SESSION</span>
        <span className={styles["session-code"]}>{session.sessionId}</span>
      </div>

      <h2 className={styles["lobby-title"]}>Waiting for players...</h2>
      <p className={styles["lobby-hint"]}>Share the session code with friends to join</p>

      <div className={styles["player-list"]}>
        {session.players.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            isCurrent={false}
            isYou={p.id === playerId}
          />
        ))}
      </div>

      <div className={styles["lobby-config"]}>
        <div className={styles["config-item"]}>
          <span>Words</span>
          <span>
            {session.config.minWordLength}→{session.config.maxWordLength} letters
          </span>
        </div>
        <div className={styles["config-item"]}>
          <span>Turn guesses</span>
          <span>{session.config.turnsPerPlayer}</span>
        </div>
        <div className={styles["config-item"]}>
          <span>Round time</span>
          <span>{session.config.sessionDurationSec}s</span>
        </div>
        <div className={styles["config-item"]}>
          <span>Hint cost</span>
          <span>{session.config.hintCostPoints} pts</span>
        </div>
      </div>

      {canStart ? (
        <button className="btn primary" onClick={onStartGame}>
          START GAME
        </button>
      ) : (
        <div className={styles["waiting-dots"]}>
          Need at least 2 players
          <span className={styles["dots-anim"]}>...</span>
        </div>
      )}
    </div>
  );
}

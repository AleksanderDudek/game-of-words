import styles from "./LobbyScreen.module.scss";
import { PlayerCard } from "../PlayerCard/PlayerCard";
import type { LobbyScreenProps } from "./LobbyScreen.types";

export function LobbyScreen({
  session,
  playerId,
  builtinPacks,
  localPacks,
  onStartGame,
  onSetPack,
  onOpenMyPacks,
}: LobbyScreenProps) {
  const minPlayers = session.config.minPlayers ?? 2;
  const activeCount = session.players.filter((p) => !p.isSpectator).length;
  const canStart = activeCount >= minPlayers;
  const spectatorCount = session.players.filter((p) => p.isSpectator).length;
  const isHost = session.hostId === playerId;

  return (
    <div className={styles["lobby-screen"]}>
      <div className={styles["session-header"]}>
        <span className={styles["session-label"]}>SESSION</span>
        <span className={styles["session-code"]}>{session.sessionId}</span>
      </div>

      <h2 className={styles["lobby-title"]}>Waiting for players...</h2>
      <p className={styles["lobby-hint"]}>
        Share the session code with friends to join
        {spectatorCount > 0 && ` • ${spectatorCount} spectator${spectatorCount !== 1 ? "s" : ""} watching`}
      </p>

      <div className={styles["player-list"]}>
        {session.players.map((p) => (
          <div key={p.id} className={styles["player-row"]}>
            <PlayerCard
              player={p}
              isCurrent={false}
              isYou={p.id === playerId}
            />
            {p.id === session.hostId && (
              <span className={styles["host-badge"]}>HOST</span>
            )}
            {p.isSpectator && (
              <span className={styles["spectator-badge"]}>SPECTATOR</span>
            )}
          </div>
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

      {/* Pack selector — host only */}
      {isHost && (
        <div className={styles["pack-selector"]}>
          <div className={styles["pack-selector-label"]}>
            WORD PACK
            {session.activePack && (
              <span className={styles["active-pack-badge"]}>
                {session.activePack.name} · {session.activePack.wordCount} words
              </span>
            )}
          </div>
          <div className={styles["pack-selector-row"]}>
            <select
              className={styles["pack-select"]}
              value={
                session.activePack
                  ? (builtinPacks.find((b) => b.name === session.activePack!.name)
                      ? `builtin:${builtinPacks.find((b) => b.name === session.activePack!.name)!.id}`
                      : `custom:${session.activePack.name}`)
                  : ""
              }
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  onSetPack({ type: "clear" });
                } else if (val.startsWith("builtin:")) {
                  onSetPack({ type: "builtin", packId: val.slice(8) });
                }
                // custom packs are sent via onOpenMyPacks → USE button
              }}
            >
              <option value="">Default (server word bank)</option>
              {builtinPacks.length > 0 && (
                <optgroup label="Built-in packs">
                  {builtinPacks.map((p) => (
                    <option key={p.id} value={`builtin:${p.id}`}>
                      {p.name} ({p.wordCount} words)
                    </option>
                  ))}
                </optgroup>
              )}
              {localPacks.length > 0 && (
                <optgroup label="My packs">
                  {localPacks.map((p) => (
                    <option key={p.id} value={`custom:${p.name}`} disabled>
                      {p.name} ({p.words.length} words) — use ↓
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <button className={styles["manage-packs-btn"]} onClick={onOpenMyPacks}>
              My Packs →
            </button>
          </div>
        </div>
      )}

      {/* Pack info for non-hosts */}
      {!isHost && session.activePack && (
        <div className={styles["pack-info-row"]}>
          <span className={styles["pack-info-label"]}>PACK</span>
          <span className={styles["pack-info-value"]}>
            {session.activePack.name} · {session.activePack.wordCount} words
          </span>
        </div>
      )}

      {canStart ? (
        <button className="btn primary" onClick={onStartGame}>
          START GAME
        </button>
      ) : (
        <div className={styles["waiting-dots"]}>
          Need at least {minPlayers} players
          <span className={styles["dots-anim"]}>...</span>
        </div>
      )}
    </div>
  );
}

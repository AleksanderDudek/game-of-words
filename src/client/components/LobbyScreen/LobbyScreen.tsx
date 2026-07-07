import { useTranslation } from "react-i18next";
import styles from "./LobbyScreen.module.scss";
import { PlayerCard } from "../PlayerCard/PlayerCard";
import { PackPicker } from "../PackPicker/PackPicker";
import type { LobbyScreenProps } from "./LobbyScreen.types";

export function LobbyScreen({
  session,
  playerId,
  builtinPacks,
  localPacks,
  onStartGame,
  onSetPack,
  onSetMaxPlayers,
  onOpenMyPacks,
}: LobbyScreenProps) {
  const { t } = useTranslation();
  const minPlayers = session.config.minPlayers ?? 2;
  const maxPlayersLimit = session.config.maxPlayers ?? 8;
  const currentMaxPlayers = session.playerLimit;
  const activeCount = session.players.filter((p) => !p.isSpectator).length;
  const canStart = activeCount >= minPlayers;
  const spectatorCount = session.players.filter((p) => p.isSpectator).length;
  const isHost = session.hostId === playerId;

  return (
    <div className={styles["lobby-screen"]}>
      <div className={styles["session-header"]}>
        <span className={styles["session-label"]}>{t("lobby.session")}</span>
        <span className={styles["session-code"]}>{session.sessionId}</span>
      </div>

      <h2 className={styles["lobby-title"]}>{t("lobby.waitingTitle")}</h2>
      <p className={styles["lobby-hint"]}>
        {t("lobby.waitingHint")}
        {spectatorCount > 0 && ` ${t("lobby.spectatorWatching", { count: spectatorCount })}`}
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
              <span className={styles["host-badge"]}>{t("lobby.hostBadge")}</span>
            )}
            {p.isSpectator && (
              <span className={styles["spectator-badge"]}>{t("lobby.spectatorBadge")}</span>
            )}
          </div>
        ))}
      </div>

      <div className={styles["lobby-config"]}>
        <div className={styles["config-item"]}>
          <span>{t("lobby.configWords")}</span>
          <span>
            {session.config.minWordLength}→{session.config.maxWordLength} {t("common.letters")}
          </span>
        </div>
        <div className={styles["config-item"]}>
          <span>{t("lobby.configTurnGuesses")}</span>
          <span>{session.config.turnsPerPlayer}</span>
        </div>
        <div className={styles["config-item"]}>
          <span>{t("lobby.configRoundTime")}</span>
          <span>{session.config.sessionDurationSec}s</span>
        </div>
        <div className={styles["config-item"]}>
          <span>{t("lobby.configHintCost")}</span>
          <span>{session.config.hintCostPoints} {t("common.pts")}</span>
        </div>
        <div className={styles["config-item"]}>
          <span>{t("lobby.configMaxPlayers")}</span>
          {isHost ? (
            <div className={styles["max-players-control"]}>
              <button
                className={styles["stepper-btn"]}
                onClick={() => onSetMaxPlayers(currentMaxPlayers - 1)}
                disabled={currentMaxPlayers <= minPlayers}
                aria-label="Decrease max players"
              >
                −
              </button>
              <span>{currentMaxPlayers}</span>
              <button
                className={styles["stepper-btn"]}
                onClick={() => onSetMaxPlayers(currentMaxPlayers + 1)}
                disabled={currentMaxPlayers >= maxPlayersLimit}
                aria-label="Increase max players"
              >
                +
              </button>
            </div>
          ) : (
            <span>{currentMaxPlayers}</span>
          )}
        </div>
      </div>

      {/* Pack selector — host only */}
      {isHost && (
        <div className={styles["pack-selector"]}>
          <div className={styles["pack-selector-label"]}>
            {t("lobby.wordPack")}
            {session.activePack && (
              <span className={styles["active-pack-badge"]}>
                {session.activePack.name} · {session.activePack.wordCount} {t("common.words")}
              </span>
            )}
          </div>
          <PackPicker
            builtinPacks={builtinPacks}
            localPacks={localPacks}
            activePackName={session.activePack?.name ?? null}
            onSelect={onSetPack}
            onManagePacks={onOpenMyPacks}
          />
        </div>
      )}

      {/* Pack info for non-hosts */}
      {!isHost && session.activePack && (
        <div className={styles["pack-info-row"]}>
          <span className={styles["pack-info-label"]}>{t("lobby.packLabel")}</span>
          <span className={styles["pack-info-value"]}>
            {session.activePack.name} · {session.activePack.wordCount} {t("common.words")}
          </span>
        </div>
      )}

      {canStart ? (
        <button className="btn primary" onClick={onStartGame}>
          {t("lobby.startGameBtn")}
        </button>
      ) : (
        <div className={styles["waiting-dots"]}>
          {t("lobby.needPlayers", { count: minPlayers })}
          <span className={styles["dots-anim"]}>...</span>
        </div>
      )}
    </div>
  );
}

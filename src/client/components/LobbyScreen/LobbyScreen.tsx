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
  // playerLimit is always present in the snapshot; fall back defensively so the
  // value (and the stepper math below) can never render blank / NaN.
  const currentMaxPlayers = session.playerLimit ?? maxPlayersLimit;
  const activeCount = session.players.filter((p) => !p.isSpectator).length;
  const canStart = activeCount >= minPlayers;
  const spectatorCount = session.players.filter((p) => p.isSpectator).length;
  const isHost = session.hostId === playerId;

  return (
    <div className={styles["lobby-screen"]}>
      {/* ─── Header (full width) ─── */}
      <header className={styles["lobby-header"]}>
        <div className={styles["session-header"]}>
          <span className={styles["session-label"]}>{t("lobby.session")}</span>
          <span className={styles["session-code"]}>{session.sessionId}</span>
        </div>
        <h2 className={styles["lobby-title"]}>{t("lobby.waitingTitle")}</h2>
        <p className={styles["lobby-hint"]}>
          {t("lobby.waitingHint")}
          {spectatorCount > 0 && ` ${t("lobby.spectatorWatching", { count: spectatorCount })}`}
        </p>
      </header>

      {/* ─── Body: session details (left) · configuration (right) ─── */}
      <div className={styles["lobby-body"]}>
        <section className={styles["lobby-col"]}>
          <div className={styles["section-label"]}>
            {t("lobby.playersLabel")} <span className={styles["section-count"]}>{session.players.length}</span>
          </div>
          <div className={styles["player-list"]}>
            {session.players.map((p) => (
              <div key={p.id} className={styles["player-row"]}>
                <PlayerCard player={p} isCurrent={false} isYou={p.id === playerId} />
                {p.id === session.hostId && (
                  <span className={styles["host-badge"]}>{t("lobby.hostBadge")}</span>
                )}
                {p.isSpectator && (
                  <span className={styles["spectator-badge"]}>{t("lobby.spectatorBadge")}</span>
                )}
              </div>
            ))}
          </div>

          <div className={styles["section-label"]}>{t("lobby.settingsLabel")}</div>
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
              <span>
                {session.config.hintCostPoints} {t("common.pts")}
              </span>
            </div>
          </div>
        </section>

        <section className={styles["lobby-col"]}>
          <div className={styles["section-label"]}>{t("lobby.wordPack")}</div>
          {isHost ? (
            <PackPicker
              builtinPacks={builtinPacks}
              localPacks={localPacks}
              activePackName={session.activePack?.name ?? null}
              onSelect={onSetPack}
              onManagePacks={onOpenMyPacks}
            />
          ) : (
            <div className={styles["pack-info-row"]}>
              <span className={styles["pack-info-value"]}>
                {session.activePack
                  ? `${session.activePack.name} · ${session.activePack.wordCount} ${t("common.words")}`
                  : t("lobby.defaultPack")}
              </span>
            </div>
          )}

          {isHost && (
            <>
              <div className={styles["section-label"]}>{t("lobby.hostControls")}</div>
              <div className={styles["config-item"]}>
                <span>{t("lobby.configMaxPlayers")}</span>
                <div className={styles["max-players-control"]}>
                  <button
                    className={styles["stepper-btn"]}
                    onClick={() => onSetMaxPlayers(currentMaxPlayers - 1)}
                    disabled={currentMaxPlayers <= minPlayers}
                    aria-label="Decrease max players"
                  >
                    −
                  </button>
                  <span className={styles["max-players-value"]}>{currentMaxPlayers}</span>
                  <button
                    className={styles["stepper-btn"]}
                    onClick={() => onSetMaxPlayers(currentMaxPlayers + 1)}
                    disabled={currentMaxPlayers >= maxPlayersLimit}
                    aria-label="Increase max players"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className={styles["range-hint"]}>
                {t("lobby.maxPlayersRange", { min: minPlayers, max: maxPlayersLimit })}
              </div>
            </>
          )}
        </section>
      </div>

      {/* ─── Footer (full width) ─── */}
      <div className={styles["lobby-footer"]}>
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
    </div>
  );
}

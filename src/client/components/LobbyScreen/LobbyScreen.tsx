import { useTranslation } from "react-i18next";
import styles from "./LobbyScreen.module.scss";
import { PlayerCard } from "../PlayerCard/PlayerCard";
import { PackPicker } from "../PackPicker/PackPicker";
import { ModePicker } from "../ModePicker/ModePicker";
import { TeamPanel } from "../TeamPanel/TeamPanel";
import { BOT_DIFFICULTY_ORDER, modeMeta } from "@/client/lib/modes";
import { TEAM_IDS } from "@/shared/types";
import type { GameMode } from "@/shared/types";
import type { LobbyScreenProps } from "./LobbyScreen.types";

export function LobbyScreen({
  session,
  playerId,
  builtinPacks,
  localPacks,
  onStartGame,
  onSetPack,
  onOpenMyPacks,
  onSetMode,
  onSetTeam,
  onSetBotDifficulty,
}: LobbyScreenProps) {
  const { t } = useTranslation();
  const mode = session.mode;
  const minPlayers = session.config.minPlayers ?? 2;
  // Max players is fixed by server configuration and shown read-only.
  const maxPlayers = session.config.maxPlayers ?? session.playerLimit;
  const activePlayers = session.players.filter((p) => !p.isSpectator);
  const humanCount = session.players.filter((p) => !p.isBot).length;
  const spectatorCount = session.players.filter((p) => p.isSpectator).length;
  const isHost = session.hostId === playerId;

  // Team games additionally need both squads manned before they can start.
  const squadsReady =
    mode !== "team" || TEAM_IDS.every((id) => activePlayers.some((p) => p.team === id));
  const canStart = activePlayers.length >= minPlayers && squadsReady;

  // Solo rooms are private, so the mode is locked once anyone else is present.
  const lockedModes: Partial<Record<GameMode, string>> =
    humanCount > 1 ? { solo: t("modes.soloLocked") } : {};

  return (
    <div className={styles["lobby-screen"]}>
      {/* ─── Header (full width) ─── */}
      <header className={styles["lobby-header"]}>
        <div className={styles["session-header"]}>
          <span className={styles["session-label"]}>{t("lobby.session")}</span>
          <span className={styles["session-code"]}>{session.sessionId}</span>
          <span className={styles["mode-chip"]}>
            {modeMeta(mode).icon} {t(`modes.${mode}.name`)}
          </span>
        </div>
        <h2 className={styles["lobby-title"]}>
          {mode === "solo" ? t("lobby.soloTitle") : t("lobby.waitingTitle")}
        </h2>
        <p className={styles["lobby-hint"]}>
          {mode === "solo" ? t("lobby.soloHint") : t("lobby.waitingHint")}
          {spectatorCount > 0 && ` ${t("lobby.spectatorWatching", { count: spectatorCount })}`}
        </p>
      </header>

      {/* ─── Body: session details (left) · configuration (right) ─── */}
      <div className={styles["lobby-body"]}>
        <section className={styles["lobby-col"]}>
          <div className={styles["section-label"]}>
            {t("lobby.playersLabel")} <span className={styles["section-count"]}>{session.players.length}</span>
          </div>

          {mode === "team" ? (
            <TeamPanel
              players={session.players}
              playerId={playerId}
              hostId={session.hostId}
              onSelectTeam={onSetTeam}
            />
          ) : (
            <div className={styles["player-list"]}>
              {session.players.map((p) => (
                <div key={p.id} className={styles["player-row"]}>
                  <PlayerCard player={p} isCurrent={false} isYou={p.id === playerId} />
                  {p.id === session.hostId && (
                    <span className={styles["host-badge"]}>{t("lobby.hostBadge")}</span>
                  )}
                  {/* the bot badge itself comes from PlayerCard */}
                  {p.isSpectator && (
                    <span className={styles["spectator-badge"]}>{t("lobby.spectatorBadge")}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className={styles["section-label"]}>{t("lobby.settingsLabel")}</div>
          <div className={styles["lobby-config"]}>
            <div className={styles["config-item"]}>
              <span>{t("lobby.configWords")}</span>
              <span>
                {session.config.minWordLength}→{session.config.maxWordLength} {t("common.letters")}
              </span>
            </div>
            <div className={styles["config-item"]}>
              <span>{mode === "coop" ? t("lobby.configSharedGuesses") : t("lobby.configTurnGuesses")}</span>
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
            {mode === "team" && (
              <div className={styles["config-item"]}>
                <span>{t("lobby.configSteal")}</span>
                <span>
                  {session.config.stealSeconds}s · {session.config.stealPointsPct}%
                </span>
              </div>
            )}
            {mode === "coop" && (
              <div className={styles["config-item"]}>
                <span>{t("lobby.configLives")}</span>
                <span>{session.config.coopLives}</span>
              </div>
            )}
            <div className={styles["config-item"]}>
              <span>{t("lobby.configMaxPlayers")}</span>
              <span>{maxPlayers}</span>
            </div>
          </div>
        </section>

        <section className={styles["lobby-col"]}>
          <div className={styles["section-label"]}>{t("lobby.modeLabel")}</div>
          <ModePicker
            value={mode}
            onChange={onSetMode}
            disabled={!isHost}
            lockedModes={lockedModes}
          />
          <p className={styles["mode-rules"]}>{t(`modes.${mode}.rules`)}</p>

          {mode === "solo" && (
            <>
              <div className={styles["section-label"]}>{t("solo.rivalLabel")}</div>
              <div className={styles["difficulty-row"]}>
                {BOT_DIFFICULTY_ORDER.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`btn ${styles["difficulty-btn"]} ${
                      session.botDifficulty === level ? styles["active"] : ""
                    }`}
                    disabled={!isHost}
                    onClick={() => onSetBotDifficulty(level)}
                  >
                    {t(`solo.difficulty.${level}`)}
                  </button>
                ))}
              </div>
              <p className={styles["mode-rules"]}>
                {t(`solo.difficultyHint.${session.botDifficulty ?? "adaptive"}`)}
              </p>
            </>
          )}

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
            {squadsReady
              ? t("lobby.needPlayers", { count: minPlayers })
              : t("lobby.needSquads")}
            <span className={styles["dots-anim"]}>...</span>
          </div>
        )}
      </div>
    </div>
  );
}

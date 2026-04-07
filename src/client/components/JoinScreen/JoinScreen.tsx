import { useTranslation } from "react-i18next";
import styles from "./JoinScreen.module.scss";
import type { JoinScreenProps } from "./JoinScreen.types";

export function JoinScreen({
  connected,
  nameInput,
  sessionIdInput,
  onNameChange,
  onSessionIdChange,
  onJoin,
  onOpenMyPacks,
}: JoinScreenProps) {
  const { t, i18n } = useTranslation();

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onJoin();
  };

  return (
    <div className={styles["join-screen"]}>
      <div className={styles["lang-switcher"]}>
        <button
          onClick={() => i18n.changeLanguage("en")}
          className={i18n.language.startsWith("en") ? styles["active"] : ""}
        >
          {t("lang.en")}
        </button>
        <button
          onClick={() => i18n.changeLanguage("pl")}
          className={i18n.language.startsWith("pl") ? styles["active"] : ""}
        >
          {t("lang.pl")}
        </button>
      </div>

      <div className={styles["logo-section"]}>
        <div className={styles["logo-badge"]}>⚡</div>
        <h1 className={styles["logo-title"]}>SIGNAL DECAY</h1>
        <p className={styles["logo-subtitle"]}>{t("join.subtitle")}</p>
      </div>

      <div className={styles["join-form"]}>
        <div
          className={`${styles["connection-status"]} ${
            connected ? styles["online"] : styles["offline"]
          }`}
        >
          <div className={styles["status-dot"]} />
          {connected ? t("join.statusConnected") : t("join.statusConnecting")}
        </div>

        <div className={styles["input-group"]}>
          <div className={styles["label-row"]}>
            <label>{t("join.callsign")}</label>
            <span className={`${styles["char-count"]} ${nameInput.length >= 14 ? styles["warn"] : ""}`}>
              {nameInput.length}/16
            </span>
          </div>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t("join.namePlaceholder")}
            maxLength={16}
            disabled={!connected}
            className={nameInput.length >= 14 ? styles["input-warn"] : ""}
          />
        </div>

        <div className={styles["input-group"]}>
          <div className={styles["label-row"]}>
            <label>
              {t("join.sessionCode")} <span className={styles["optional"]}>{t("join.optional")}</span>
            </label>
            {sessionIdInput && (
              <span className={styles["char-count"]}>{sessionIdInput.length}/8</span>
            )}
          </div>
          <input
            type="text"
            value={sessionIdInput}
            onChange={(e) => onSessionIdChange(e.target.value.toUpperCase())}
            onKeyDown={handleKey}
            placeholder={t("join.sessionPlaceholder")}
            maxLength={8}
            disabled={!connected}
            style={{ textTransform: "uppercase" }}
          />
        </div>

        <button
          className="btn primary"
          onClick={onJoin}
          disabled={!connected || !nameInput.trim()}
        >
          {t("join.connectBtn")}
        </button>
        <button className="btn" onClick={onOpenMyPacks}>
          {t("join.myPacksBtn")}
        </button>
      </div>

      <div className={styles["rules-brief"]}>
        <h3>{t("join.howItWorks")}</h3>
        <p dangerouslySetInnerHTML={{ __html: t("join.rules") }} />
      </div>
    </div>
  );
}

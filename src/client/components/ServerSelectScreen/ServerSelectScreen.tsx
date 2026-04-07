import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import styles from "./ServerSelectScreen.module.scss";
import type { ServerSelectScreenProps, ServerStatus } from "./ServerSelectScreen.types";
import type { GameServerEntry, ServerInfo } from "@/shared/types";

/** Ping a server's REST API and measure round-trip latency */
async function pingServer(server: GameServerEntry): Promise<ServerStatus> {
  const httpUrl = server.url
    .replace("wss://", "https://")
    .replace("ws://", "http://");

  const start = performance.now();
  try {
    const res = await fetch(`${httpUrl}/api/info`, { signal: AbortSignal.timeout(5000) });
    const latency = Math.round(performance.now() - start);
    if (!res.ok) return { info: null, latency: null, error: true };
    const info = (await res.json()) as ServerInfo;
    return { info, latency, error: false };
  } catch {
    return { info: null, latency: null, error: true };
  }
}

function latencyClass(ms: number): string {
  if (ms > 200) return styles["high"];
  if (ms > 100) return styles["medium"];
  return "";
}

export function ServerSelectScreen({ servers, onSelect }: ServerSelectScreenProps) {
  const { t } = useTranslation();
  const [statuses, setStatuses] = useState<Map<string, ServerStatus>>(new Map());

  const refreshAll = useCallback(() => {
    servers.forEach(async (server) => {
      const status = await pingServer(server);
      setStatuses((prev) => new Map(prev).set(server.id, status));
    });
  }, [servers]);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 15000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  const handleSelect = (server: GameServerEntry) => {
    const status = statuses.get(server.id);
    if (status?.error) return;
    onSelect(server);
  };

  return (
    <div className={styles["server-select-screen"]}>
      <h1 className={styles["select-title"]}>{t("serverSelect.title")}</h1>
      <p className={styles["select-subtitle"]}>{t("serverSelect.subtitle")}</p>

      <div className={styles["server-list"]}>
        {servers.map((server) => {
          const status = statuses.get(server.id);
          const isOffline = status?.error === true;
          const cardClass = [
            styles["server-card"],
            isOffline ? styles["offline"] : "",
          ].filter(Boolean).join(" ");

          return (
            <div
              key={server.id}
              className={cardClass}
              onClick={() => handleSelect(server)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && handleSelect(server)}
            >
              <span className={styles["server-flag"]}>{server.flag}</span>
              <div className={styles["server-info"]}>
                <span className={styles["server-name"]}>{server.name}</span>
                <span className={styles["server-region"]}>{server.region}</span>
              </div>
              <div className={styles["server-meta"]}>
                {status === undefined ? (
                  <span className={`${styles["server-latency"]} ${styles["loading-dot"]}`}>
                    {t("serverSelect.pinging")}
                  </span>
                ) : isOffline ? (
                  <span className={styles["server-latency"]}>{t("serverSelect.offline")}</span>
                ) : (
                  <>
                    <span
                      className={`${styles["server-latency"]} ${latencyClass(status.latency!)}`}
                    >
                      {status.latency}{t("serverSelect.ms")}
                    </span>
                    {status.info && (
                      <span className={styles["server-players"]}>
                        {t("serverSelect.playersOnline", { count: status.info.totalPlayers })}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

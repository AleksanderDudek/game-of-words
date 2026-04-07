import { useRef } from "react";
import styles from "./MyPacksScreen.module.scss";
import { usePackStorage } from "@/client/hooks/usePackStorage/usePackStorage";
import type { MyPacksScreenProps } from "./MyPacksScreen.types";
import type { WordPack } from "@/client/lib/wordPack";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function MyPacksScreen({ onClose, onSelectPack, selectedPackId }: MyPacksScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    packs,
    driveConnected,
    driveAvailable,
    loading,
    error,
    addPackFromFile,
    deletePack,
    connectDrive,
    disconnectDrive,
    syncToDrive,
  } = usePackStorage();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      await addPackFromFile(file);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to import pack");
    }
  }

  async function handleSync(pack: WordPack) {
    try {
      await syncToDrive(pack);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Sync failed");
    }
  }

  async function handleDelete(pack: WordPack) {
    if (!confirm(`Delete "${pack.name}"?`)) return;
    await deletePack(pack);
  }

  return (
    <div className={styles["my-packs-screen"]}>
      {/* Header */}
      <div className={styles["header"]}>
        <button className={styles["back-btn"]} onClick={onClose}>
          ← BACK
        </button>
        <h2 className={styles["title"]}>MY PACKS</h2>
      </div>

      {/* Google Drive section */}
      <div className={styles["drive-section"]}>
        <div className={styles["drive-icon"]}>☁</div>
        <div className={styles["drive-info"]}>
          <div className={styles["drive-title"]}>Google Drive Sync</div>
          <div className={styles["drive-subtitle"]}>
            {driveConnected
              ? "Packs are backed up to your Google Drive and available on all devices."
              : driveAvailable
              ? "Connect to back up packs to your Google Drive — no account on our side needed."
              : "Configure VITE_GOOGLE_CLIENT_ID to enable Drive sync."}
          </div>
        </div>
        {driveConnected ? (
          <div className={`${styles["drive-badge"]} ${styles["connected"]}`}>CONNECTED</div>
        ) : driveAvailable ? (
          <button className="btn" onClick={connectDrive}>
            Connect
          </button>
        ) : (
          <button className="btn" disabled>
            Not configured
          </button>
        )}
        {driveConnected && (
          <button className="btn" onClick={disconnectDrive} style={{ marginLeft: 4 }}>
            Disconnect
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && <div className={styles["error-banner"]}>{error}</div>}

      {/* Upload */}
      <div className={styles["upload-area"]}>
        <button
          className={styles["upload-btn"]}
          onClick={() => fileInputRef.current?.click()}
        >
          + IMPORT PACK FROM FILE
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <p className={styles["upload-hint"]}>
          JSON format: <code>{"{ name, words: [{ word, hint }] }"}</code>
          <br />
          Up to 500 words per pack.
        </p>
      </div>

      {/* Pack list */}
      {!loading && packs.length === 0 ? (
        <div className={styles["empty-state"]}>
          No packs yet.
          <br />
          Import a JSON file or download a template from the README.
        </div>
      ) : (
        <>
          <div className={styles["section-label"]}>SAVED PACKS — {packs.length}</div>
          <div className={styles["pack-list"]}>
            {packs.map((pack) => (
              <div
                key={pack.id}
                className={`${styles["pack-card"]} ${pack.id === selectedPackId ? styles["selected"] : ""}`}
              >
                <div className={styles["pack-info"]}>
                  <div className={styles["pack-name"]}>{pack.name}</div>
                  <div className={styles["pack-meta"]}>
                    <span
                      className={`${styles["source-badge"]} ${styles[pack.source]}`}
                    >
                      {pack.source.toUpperCase()}
                    </span>
                    <span>{pack.words.length} words</span>
                    <span>Added {formatDate(pack.createdAt)}</span>
                    {pack.lastUsedAt && <span>Used {formatDate(pack.lastUsedAt)}</span>}
                  </div>
                </div>
                <div className={styles["pack-actions"]}>
                  {onSelectPack && (
                    <button
                      className={`${styles["action-btn"]} ${styles["use"]}`}
                      onClick={() => onSelectPack(pack)}
                    >
                      USE
                    </button>
                  )}
                  {driveConnected && pack.source === "local" && (
                    <button
                      className={`${styles["action-btn"]} ${styles["sync"]}`}
                      onClick={() => handleSync(pack)}
                    >
                      ↑ SYNC
                    </button>
                  )}
                  <button
                    className={`${styles["action-btn"]} ${styles["delete"]}`}
                    onClick={() => handleDelete(pack)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

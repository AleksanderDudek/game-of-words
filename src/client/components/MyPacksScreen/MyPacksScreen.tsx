import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./MyPacksScreen.module.scss";
import { usePackStorage } from "@/client/hooks/usePackStorage/usePackStorage";
import { PackEditorScreen } from "@/client/components/PackEditorScreen/PackEditorScreen";
import type { MyPacksScreenProps } from "./MyPacksScreen.types";
import type { WordPack } from "@/client/lib/wordPack";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function MyPacksScreen({ onClose, onSelectPack, selectedPackId }: MyPacksScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // null = list view, undefined = create new, WordPack = edit existing
  const { t } = useTranslation();
  const [editorPack, setEditorPack] = useState<WordPack | undefined | null>(null);

  const {
    packs,
    driveConnected,
    driveAvailable,
    loading,
    error,
    addPackFromFile,
    savePack,
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
      alert(err instanceof Error ? err.message : t("myPacks.importFailed"));
    }
  }

  async function handleSync(pack: WordPack) {
    try {
      await syncToDrive(pack);
    } catch (err) {
      alert(err instanceof Error ? err.message : t("myPacks.syncFailed"));
    }
  }

  async function handleDelete(pack: WordPack) {
    if (!confirm(t("myPacks.deleteConfirm", { name: pack.name }))) return;
    await deletePack(pack);
  }

  function handleExport(pack: WordPack) {
    const json = JSON.stringify(
      { name: pack.name, description: pack.description, words: pack.words },
      null,
      2
    );
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pack.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadSample() {
    const sample = {
      name: "My Sample Pack",
      description: "An example word pack — replace with your own words and hints.",
      words: [
        { word: "signal", hint: "A transmitted message or impulse" },
        { word: "decode", hint: "To convert a coded message into plain language" },
        { word: "cipher", hint: "A secret method of writing" },
        { word: "entropy", hint: "A measure of randomness or disorder" },
        { word: "frequency", hint: "The rate at which something occurs" },
      ],
    };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample-pack.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Pack editor subscreen ───
  if (editorPack !== null) {
    return (
      <PackEditorScreen
        initialPack={editorPack}
        onSave={savePack}
        onClose={() => setEditorPack(null)}
      />
    );
  }

  return (
    <div className={styles["my-packs-screen"]}>
      {/* Header */}
      <div className={styles["header"]}>
        <button className={styles["back-btn"]} onClick={onClose}>
          {t("common.back")}
        </button>
        <h2 className={styles["title"]}>{t("myPacks.title")}</h2>
      </div>

      {/* Google Drive section */}
      <div className={styles["drive-section"]}>
        <div className={styles["drive-icon"]}>☁</div>
        <div className={styles["drive-info"]}>
          <div className={styles["drive-title"]}>{t("myPacks.driveTitle")}</div>
          <div className={styles["drive-subtitle"]}>
            {driveConnected
              ? t("myPacks.driveConnected")
              : driveAvailable
              ? t("myPacks.driveAvailable")
              : t("myPacks.driveUnconfigured")}
          </div>
        </div>
        {driveConnected ? (
          <div className={`${styles["drive-badge"]} ${styles["connected"]}`}>{t("myPacks.connectedBadge")}</div>
        ) : driveAvailable ? (
          <button className="btn" onClick={connectDrive}>
            {t("myPacks.connectBtn")}
          </button>
        ) : (
          <button className="btn" disabled>
            {t("myPacks.notConfiguredBtn")}
          </button>
        )}
        {driveConnected && (
          <button className="btn" onClick={disconnectDrive} style={{ marginLeft: 4 }}>
            {t("myPacks.disconnectBtn")}
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && <div className={styles["error-banner"]}>{error}</div>}

      {/* Upload / Create */}
      <div className={styles["upload-area"]}>
        <button
          className={styles["upload-btn"]}
          onClick={() => setEditorPack(undefined)}
        >
          {t("myPacks.createBtn")}
        </button>
        <button
          className={styles["upload-btn"]}
          onClick={() => fileInputRef.current?.click()}
        >
          {t("myPacks.importBtn")}
        </button>
        <button
          className={styles["sample-btn"]}
          onClick={handleDownloadSample}
        >
          {t("myPacks.sampleBtn")}
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
          {t("myPacks.emptyState").split("\n").map((line, i) => i === 0 ? <span key={i}>{line}<br /></span> : <span key={i}>{line}</span>)}
        </div>
      ) : (
        <>
          <div className={styles["section-label"]}>{t("myPacks.savedPacks")} — {packs.length}</div>
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
                    <span>{pack.words.length} {t("common.words")}</span>
                    <span>{t("myPacks.added")} {formatDate(pack.createdAt)}</span>
                    {pack.lastUsedAt && <span>{t("myPacks.used")} {formatDate(pack.lastUsedAt)}</span>}
                  </div>
                </div>
                <div className={styles["pack-actions"]}>
                  {onSelectPack && (
                    <button
                      className={`${styles["action-btn"]} ${styles["use"]}`}
                      onClick={() => onSelectPack(pack)}
                    >
                      {t("myPacks.useBtn")}
                    </button>
                  )}
                  <button
                    className={`${styles["action-btn"]} ${styles["edit"]}`}
                    onClick={() => setEditorPack(pack)}
                  >
                    {t("myPacks.editBtn")}
                  </button>
                  <button
                    className={`${styles["action-btn"]} ${styles["export"]}`}
                    onClick={() => handleExport(pack)}
                  >
                    {t("myPacks.exportBtn")}
                  </button>
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

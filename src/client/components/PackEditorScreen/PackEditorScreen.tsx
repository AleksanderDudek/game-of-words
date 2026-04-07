import { useState } from "react";
import { v4 as uuid } from "uuid";
import { useTranslation } from "react-i18next";
import styles from "./PackEditorScreen.module.scss";
import type { WordPack } from "@/client/lib/wordPack";

interface Row {
  word: string;
  hint: string;
}

interface Props {
  initialPack?: WordPack;
  onSave: (pack: WordPack) => Promise<void>;
  onClose: () => void;
}

export function PackEditorScreen({ initialPack, onSave, onClose }: Props) {
  const [name, setName] = useState(initialPack?.name ?? "");
  const [description, setDescription] = useState(initialPack?.description ?? "");
  const [rows, setRows] = useState<Row[]>(
    initialPack?.words.length
      ? initialPack.words.map((e) => ({ word: e.word, hint: e.hint }))
      : [{ word: "", hint: "" }]
  );
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(i: number, field: keyof Row, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { word: "", hint: "" }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("packEditor.errorName"));
      return;
    }
    const validRows = rows.filter((r) => r.word.trim() && r.hint.trim());
    if (validRows.length === 0) {
      setError(t("packEditor.errorWords"));
      return;
    }

    const pack: WordPack = {
      id: initialPack?.id ?? uuid(),
      name: trimmedName.slice(0, 50),
      description: description.trim().slice(0, 200) || undefined,
      words: validRows.slice(0, 500).map((r) => ({
        word: r.word.toLowerCase().trim().slice(0, 50),
        hint: r.hint.trim().slice(0, 200),
      })),
      createdAt: initialPack?.createdAt ?? Date.now(),
      lastUsedAt: initialPack?.lastUsedAt,
      source: initialPack?.source ?? "local",
      driveFileId: initialPack?.driveFileId,
    };

    setSaving(true);
    try {
      await onSave(pack);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save pack");
      setSaving(false);
    }
  }

  const validCount = rows.filter((r) => r.word.trim() && r.hint.trim()).length;

  return (
    <div className={styles["editor"]}>
      {/* Header */}
      <div className={styles["header"]}>
        <button className={styles["back-btn"]} onClick={onClose}>
          {t("common.back")}
        </button>
        <h2 className={styles["title"]}>{initialPack ? t("packEditor.titleEdit") : t("packEditor.titleNew")}</h2>
        <button className={styles["save-btn"]} onClick={handleSave} disabled={saving}>
          {saving ? t("packEditor.saving") : t("packEditor.save")}
        </button>
      </div>

      {/* Error */}
      {error && <div className={styles["error"]}>{error}</div>}

      {/* Name + description */}
      <div className={styles["meta"]}>
        <div className={styles["field-wrap"]}>
          <input
            className={`${styles["name-input"]} ${name.length >= 45 ? styles["near-limit"] : ""}`}
            placeholder={t("packEditor.namePlaceholder")}
            value={name}
            maxLength={50}
            onChange={(e) => setName(e.target.value)}
          />
          <span className={`${styles["char-count"]} ${name.length >= 45 ? styles["warn"] : ""}`}>
            {name.length}/50
          </span>
        </div>
        <div className={styles["field-wrap"]}>
          <input
            className={`${styles["desc-input"]} ${description.length >= 180 ? styles["near-limit"] : ""}`}
            placeholder={t("packEditor.descPlaceholder")}
            value={description}
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
          />
          {description.length > 0 && (
            <span className={`${styles["char-count"]} ${description.length >= 180 ? styles["warn"] : ""}`}>
              {description.length}/200
            </span>
          )}
        </div>
      </div>

      {/* Table header */}
      <div className={styles["table-header"]}>
        <span>{t("packEditor.colWord")}</span>
        <span>{t("packEditor.colHint")}</span>
        <span />
      </div>

      {/* Rows */}
      <div className={styles["rows"]}>
        {rows.map((row, i) => (
          <div key={i} className={styles["row"]}>
            <input
              className={styles["word-input"]}
              placeholder={t("packEditor.wordPlaceholder")}
              value={row.word}
              maxLength={50}
              onChange={(e) => updateRow(i, "word", e.target.value)}
            />
            <div className={styles["hint-wrap"]}>
              <input
                className={`${styles["hint-input"]} ${row.hint.length >= 180 ? styles["near-limit"] : ""}`}
                placeholder={t("packEditor.hintPlaceholder")}
                value={row.hint}
                maxLength={200}
                onChange={(e) => updateRow(i, "hint", e.target.value)}
              />
              {row.hint.length >= 160 && (
                <span className={`${styles["hint-char-count"]} ${row.hint.length >= 180 ? styles["warn"] : ""}`}>
                  {row.hint.length}/200
                </span>
              )}
            </div>
            <button
              className={styles["del-btn"]}
              onClick={() => removeRow(i)}
              disabled={rows.length === 1}
              title={t("packEditor.removeRow")}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add row */}
      <button className={styles["add-row-btn"]} onClick={addRow} disabled={rows.length >= 500}>
        {t("packEditor.addWord")}
      </button>

      <div className={styles["footer-hint"]}>
        <span className={validCount >= 490 ? styles["warn"] : ""}>
          {t("packEditor.footerHint", { count: validCount })}
        </span>
      </div>
    </div>
  );
}

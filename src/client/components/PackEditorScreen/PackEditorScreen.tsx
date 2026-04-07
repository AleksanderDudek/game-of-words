import { useState } from "react";
import { v4 as uuid } from "uuid";
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
      setError("Pack name is required.");
      return;
    }
    const validRows = rows.filter((r) => r.word.trim() && r.hint.trim());
    if (validRows.length === 0) {
      setError("Add at least one word with a hint.");
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
          ← BACK
        </button>
        <h2 className={styles["title"]}>{initialPack ? "EDIT PACK" : "NEW PACK"}</h2>
        <button className={styles["save-btn"]} onClick={handleSave} disabled={saving}>
          {saving ? "SAVING…" : "✓ SAVE"}
        </button>
      </div>

      {/* Error */}
      {error && <div className={styles["error"]}>{error}</div>}

      {/* Name + description */}
      <div className={styles["meta"]}>
        <input
          className={styles["name-input"]}
          placeholder="Pack name…"
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={styles["desc-input"]}
          placeholder="Description — shown in the pack list (optional)"
          value={description}
          maxLength={200}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Table header */}
      <div className={styles["table-header"]}>
        <span>WORD</span>
        <span>HINT — shown to other players</span>
        <span />
      </div>

      {/* Rows */}
      <div className={styles["rows"]}>
        {rows.map((row, i) => (
          <div key={i} className={styles["row"]}>
            <input
              className={styles["word-input"]}
              placeholder="word"
              value={row.word}
              maxLength={50}
              onChange={(e) => updateRow(i, "word", e.target.value)}
            />
            <input
              className={styles["hint-input"]}
              placeholder="clue…"
              value={row.hint}
              maxLength={200}
              onChange={(e) => updateRow(i, "hint", e.target.value)}
            />
            <button
              className={styles["del-btn"]}
              onClick={() => removeRow(i)}
              disabled={rows.length === 1}
              title="Remove row"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add row */}
      <button className={styles["add-row-btn"]} onClick={addRow} disabled={rows.length >= 500}>
        + ADD WORD
      </button>

      <div className={styles["footer-hint"]}>
        {validCount} / 500 valid {validCount === 1 ? "entry" : "entries"} — empty rows are ignored on save
      </div>
    </div>
  );
}

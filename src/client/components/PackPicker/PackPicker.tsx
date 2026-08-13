import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./PackPicker.module.scss";
import type { PackPickerProps, SortKey } from "./PackPicker.types";
import type { PackReference } from "@/shared/types";

interface PackItem {
  key: string;
  /** Key the server uses for this pack — "builtin:<id>" / "custom:<name>". */
  selectionKey: string;
  name: string;
  description: string;
  wordCount: number;
  source: "builtin" | "local";
  /** 1 = easy, 2 = medium, 3 = hard, 0 = none (derived from the pack name). */
  difficulty: number;
  ref: PackReference;
}

const DIFF_RANK: Record<string, number> = { easy: 1, medium: 2, hard: 3 };

function parseDifficulty(name: string): number {
  const m = name.match(/\b(easy|medium|hard)\b/i);
  return m ? DIFF_RANK[m[1].toLowerCase()] : 0;
}

/**
 * Searchable, sortable pack selector. Replaces the native <select> so the
 * 40+ built-in packs (plus custom packs) stay browsable: type to filter,
 * sort by name / difficulty / size, and pick built-in or custom packs directly.
 */
export function PackPicker({
  builtinPacks,
  localPacks,
  activePackName,
  onSelect,
  onManagePacks,
  multiSelect = false,
  selectedKeys = [],
  onSelectMany,
}: PackPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo<PackItem[]>(() => {
    const builtin: PackItem[] = builtinPacks.map((p) => ({
      key: `builtin:${p.id}`,
      selectionKey: `builtin:${p.id}`,
      name: p.name,
      description: p.description,
      wordCount: p.wordCount,
      source: "builtin",
      difficulty: parseDifficulty(p.name),
      ref: { type: "builtin", packId: p.id },
    }));
    const local: PackItem[] = localPacks.map((p) => ({
      key: `local:${p.id}`,
      // Custom packs are identified by name server-side — two local packs
      // sharing a name are the same selection as far as the session is aware.
      selectionKey: `custom:${p.name}`,
      name: p.name,
      description: p.description ?? "",
      wordCount: p.words.length,
      source: "local",
      difficulty: parseDifficulty(p.name),
      ref: { type: "custom", name: p.name, words: p.words },
    }));
    return [...builtin, ...local];
  }, [builtinPacks, localPacks]);

  const filtered = useMemo<PackItem[]>(() => {
    // Split into tokens and require every token to appear in name+description,
    // so multi-word queries like "psychology hard" match "… Psychology — Hard".
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = tokens.length
      ? items.filter((it) => {
          const haystack = `${it.name} ${it.description}`.toLowerCase();
          return tokens.every((tok) => haystack.includes(tok));
        })
      : items.slice();
    list.sort((a, b) => {
      if (sort === "words") return b.wordCount - a.wordCount || a.name.localeCompare(b.name);
      if (sort === "difficulty") {
        const ra = a.difficulty || 99;
        const rb = b.difficulty || 99;
        return ra - rb || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [items, query, sort]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Focus the search box when opening; reset the query when closing.
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery("");
  }, [open]);

  const selected = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  function choose(ref: PackReference) {
    onSelect(ref);
    setOpen(false);
  }

  /**
   * Multi-select: flip one pack in or out and send the whole selection. The
   * panel stays open so a host can stack several packs in one pass.
   */
  function toggle(item: PackItem) {
    const next = selected.has(item.selectionKey)
      ? items.filter((it) => selected.has(it.selectionKey) && it.selectionKey !== item.selectionKey)
      : [...items.filter((it) => selected.has(it.selectionKey)), item];
    onSelectMany?.(next.map((it) => it.ref));
  }

  function clearSelection() {
    if (multiSelect) {
      onSelectMany?.([]);
      return;
    }
    choose({ type: "clear" });
  }

  const isDefault = multiSelect ? selected.size === 0 : !activePackName;
  const selectedWordCount = items
    .filter((it) => selected.has(it.selectionKey))
    .reduce((sum, it) => sum + it.wordCount, 0);

  let triggerLabel: string;
  if (isDefault) {
    triggerLabel = t("lobby.defaultPack");
  } else if (multiSelect) {
    triggerLabel = t("lobby.packsSelected", { count: selected.size, words: selectedWordCount });
  } else {
    triggerLabel = activePackName ?? t("lobby.defaultPack");
  }

  function diffLabel(difficulty: number): string {
    if (difficulty === 1) return t("lobby.diffEasy");
    if (difficulty === 2) return t("lobby.diffMedium");
    return t("lobby.diffHard");
  }

  return (
    <div className={styles["picker"]} ref={rootRef}>
      <button
        type="button"
        className={styles["trigger"]}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={isDefault ? styles["trigger-default"] : styles["trigger-name"]}>
          {triggerLabel}
        </span>
        <span className={styles["chevron"]} aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className={styles["panel"]}>
          <div className={styles["controls"]}>
            <input
              ref={inputRef}
              type="text"
              className={styles["search"]}
              value={query}
              placeholder={t("lobby.packSearchPlaceholder")}
              aria-label={t("lobby.packSearchPlaceholder")}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || filtered.length === 0) return;
                if (multiSelect) toggle(filtered[0]);
                else choose(filtered[0].ref);
              }}
            />
            <select
              className={styles["sort"]}
              value={sort}
              aria-label={t("lobby.sortLabel")}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="name">{t("lobby.sortName")}</option>
              <option value="difficulty">{t("lobby.sortDifficulty")}</option>
              <option value="words">{t("lobby.sortWords")}</option>
            </select>
          </div>

          <ul className={styles["list"]} role="listbox">
            <li role="option" aria-selected={isDefault}>
              <button
                type="button"
                className={`${styles["row"]} ${isDefault ? styles["row-active"] : ""}`}
                onClick={clearSelection}
              >
                <span className={styles["row-main"]}>
                  <span className={styles["row-name"]}>{t("lobby.defaultPack")}</span>
                </span>
              </button>
            </li>

            {filtered.map((it) => {
              const active = multiSelect ? selected.has(it.selectionKey) : activePackName === it.name;
              return (
                <li key={it.key} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={`${styles["row"]} ${active ? styles["row-active"] : ""}`}
                    onClick={() => (multiSelect ? toggle(it) : choose(it.ref))}
                  >
                    {multiSelect && (
                      <span className={styles["check"]} aria-hidden>
                        {active ? "☑" : "☐"}
                      </span>
                    )}
                    <span className={styles["row-main"]}>
                      <span className={styles["row-name"]}>{it.name}</span>
                      {it.description && <span className={styles["row-desc"]}>{it.description}</span>}
                    </span>
                    <span className={styles["row-meta"]}>
                      {it.difficulty > 0 && (
                        <span className={`${styles["diff"]} ${styles[`diff-${it.difficulty}`]}`}>
                          {diffLabel(it.difficulty)}
                        </span>
                      )}
                      {it.source === "local" && (
                        <span className={styles["mine"]}>{t("lobby.mineBadge")}</span>
                      )}
                      <span className={styles["count"]} title={`${it.wordCount} ${t("common.words")}`}>
                        {it.wordCount}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}

            {filtered.length === 0 && (
              <li className={styles["empty"]}>
                {t("lobby.noPacksMatch", { query: query.trim() })}
              </li>
            )}
          </ul>

          <button
            type="button"
            className={styles["manage"]}
            onClick={() => {
              setOpen(false);
              onManagePacks();
            }}
          >
            {t("lobby.managePacksBtn")}
          </button>
        </div>
      )}
    </div>
  );
}

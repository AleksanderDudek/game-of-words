import { useTranslation } from "react-i18next";
import styles from "./ModePicker.module.scss";
import { MODE_META } from "@/client/lib/modes";
import type { ModePickerProps } from "./ModePicker.types";

export function ModePicker({
  value,
  onChange,
  disabled = false,
  lockedModes,
  compact = false,
}: ModePickerProps) {
  const { t } = useTranslation();

  const rootClass = [styles["mode-picker"], compact ? styles["compact"] : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} role="radiogroup" aria-label={t("modes.pickerLabel")}>
      {MODE_META.map((meta) => {
        const lockedReason = lockedModes?.[meta.id];
        const isLocked = Boolean(lockedReason);
        const selected = value === meta.id;
        const cardClass = [
          styles["mode-card"],
          selected ? styles["selected"] : "",
          isLocked ? styles["locked"] : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={meta.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cardClass}
            disabled={disabled || isLocked}
            title={lockedReason}
            onClick={() => onChange(meta.id)}
          >
            <span className={styles["mode-icon"]} aria-hidden="true">
              {meta.icon}
            </span>
            <span className={styles["mode-text"]}>
              <span className={styles["mode-name"]}>{t(`modes.${meta.id}.name`)}</span>
              {!compact && (
                <span className={styles["mode-desc"]}>{t(`modes.${meta.id}.tagline`)}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

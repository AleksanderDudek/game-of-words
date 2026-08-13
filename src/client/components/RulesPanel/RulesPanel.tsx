import { useTranslation } from "react-i18next";
import styles from "./RulesPanel.module.scss";
import type { RulesPanelProps } from "./RulesPanel.types";
import type { CustomRules } from "@/shared/types";
import { DURATION_BANDS, RULE_BOUNDS, bandById, clampRule } from "@/shared/rules";
import type { NumericRuleKey } from "@/shared/rules";
import { estimateDuration, fitBand, wordsForBand, formatDuration } from "@/shared/estimate";

/**
 * Host-only lobby controls for how long a game should run and how tightly it
 * should be played. Everything here is an override: with the panel switched
 * off the session keeps every server default, so a host who ignores it gets
 * exactly the game the room has always played.
 *
 * The panel is driven straight off the session snapshot rather than local
 * state — the server is the one authority on the rules, and every player in
 * the lobby watches the same numbers change.
 */
export function RulesPanel({
  mode,
  config,
  rules,
  packWordCount,
  disabled = false,
  onChange,
}: Readonly<RulesPanelProps>) {
  const { t } = useTranslation();
  const enabled = rules !== undefined;

  // Each unset rule falls back to the config, which the server already
  // resolved — so these are the numbers actually in play right now.
  const roundSeconds = rules?.roundSeconds ?? config.sessionDurationSec;
  const guessesPerTurn = rules?.guessesPerTurn ?? config.turnsPerPlayer;
  const coopLives = rules?.coopLives ?? config.coopLives ?? 3;
  const words = rules?.wordGoal ?? config.wordCount ?? 0;
  const band = bandById(rules?.targetBand);

  const estimateInput = {
    words,
    roundSeconds,
    mode,
    countdownSeconds: config.lobbyCountdownSec ?? 0,
    stealSeconds: config.stealSeconds ?? 0,
  };
  const estimate = estimateDuration(estimateInput);
  const fit = band ? fitBand(estimate, band) : null;
  const suggestedWords = band ? wordsForBand(band, estimateInput) : null;
  // A goal larger than the pool means the queue wraps and words come round again.
  const willRepeat = packWordCount > 0 && words > packWordCount;

  function patch(next: Partial<CustomRules>) {
    onChange({ ...(rules ?? {}), ...next });
  }

  function bump(key: NumericRuleKey, current: number, delta: number) {
    patch({ [key]: clampRule(key, current + delta) });
  }

  function selectBand(id: string) {
    const target = bandById(id);
    if (!target) return;
    // Picking a length is only a starting point — it fills in the word count
    // that lands mid-band, and the host is free to nudge it afterwards.
    patch({ targetBand: id, wordGoal: wordsForBand(target, estimateInput) });
  }

  function toggleEnabled() {
    onChange(enabled ? null : { wordGoal: config.wordCount ?? 1 });
  }

  return (
    <div className={styles["rules-panel"]}>
      <button
        type="button"
        className={styles["toggle"]}
        onClick={toggleEnabled}
        disabled={disabled}
        aria-pressed={enabled}
      >
        <span className={`${styles["switch"]} ${enabled ? styles["switch-on"] : ""}`} aria-hidden>
          <span className={styles["knob"]} />
        </span>
        <span className={styles["toggle-label"]}>{t("rules.customize")}</span>
        <span className={styles["toggle-state"]}>
          {enabled ? t("rules.stateCustom") : t("rules.stateDefault")}
        </span>
      </button>

      {!enabled && <p className={styles["hint"]}>{t("rules.defaultHint")}</p>}

      {enabled && (
        <div className={styles["body"]}>
          {/* ─── Target length ─── */}
          <div className={styles["field-label"]}>{t("rules.targetLength")}</div>
          <div className={styles["band-row"]}>
            {DURATION_BANDS.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`btn ${styles["band-btn"]} ${band?.id === b.id ? styles["active"] : ""}`}
                disabled={disabled}
                onClick={() => selectBand(b.id)}
              >
                {t("rules.bandLabel", { min: b.minMinutes, max: b.maxMinutes })}
              </button>
            ))}
          </div>

          {/* ─── Numeric rules ─── */}
          <Stepper
            label={t("rules.wordCount")}
            value={words}
            suffix={t("common.words")}
            disabled={disabled}
            bounds={RULE_BOUNDS.wordGoal}
            onStep={(delta) => bump("wordGoal", words, delta)}
            steps={[1, 5]}
          />
          {packWordCount > 0 && (
            <button
              type="button"
              className={styles["link-btn"]}
              disabled={disabled}
              onClick={() => patch({ wordGoal: clampRule("wordGoal", packWordCount) })}
            >
              {t("rules.usePackWords", { count: packWordCount })}
            </button>
          )}

          <Stepper
            label={t("rules.roundTime")}
            value={roundSeconds}
            suffix="s"
            disabled={disabled}
            bounds={RULE_BOUNDS.roundSeconds}
            onStep={(delta) => bump("roundSeconds", roundSeconds, delta)}
            steps={[5, 15]}
          />

          <Stepper
            label={mode === "coop" ? t("lobby.configSharedGuesses") : t("lobby.configTurnGuesses")}
            value={guessesPerTurn}
            disabled={disabled}
            bounds={RULE_BOUNDS.guessesPerTurn}
            onStep={(delta) => bump("guessesPerTurn", guessesPerTurn, delta)}
            steps={[1]}
          />

          {mode === "coop" && (
            <Stepper
              label={t("lobby.configLives")}
              value={coopLives}
              disabled={disabled}
              bounds={RULE_BOUNDS.coopLives}
              onStep={(delta) => bump("coopLives", coopLives, delta)}
              steps={[1]}
            />
          )}

          {/* ─── Feedback ─── */}
          <div className={styles["estimate"]} role="status">
            <div className={styles["estimate-main"]}>
              {t("rules.estimate", { time: formatDuration(estimate.expectedSec) })}
            </div>
            <div className={styles["estimate-range"]}>
              {t("rules.estimateRange", {
                low: formatDuration(estimate.lowSec),
                high: formatDuration(estimate.highSec),
              })}
            </div>
            {fit && band && (
              <div className={`${styles["fit"]} ${styles[`fit-${fit}`]}`}>
                {fit === "fits"
                  ? t("rules.fitOk", { min: band.minMinutes, max: band.maxMinutes })
                  : t(fit === "under" ? "rules.fitUnder" : "rules.fitOver", {
                      min: band.minMinutes,
                      max: band.maxMinutes,
                      words: suggestedWords ?? 0,
                    })}
              </div>
            )}
            {willRepeat && (
              <div className={styles["warn"]}>
                {t("rules.repeatWarning", { words: packWordCount })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface StepperProps {
  label: string;
  value: number;
  suffix?: string;
  disabled: boolean;
  bounds: { min: number; max: number };
  steps: number[];
  onStep: (delta: number) => void;
}

/** −/+ pairs for every step size, so big jumps do not take twenty clicks. */
function Stepper({ label, value, suffix, disabled, bounds, steps, onStep }: Readonly<StepperProps>) {
  return (
    <div className={styles["stepper"]}>
      <span className={styles["stepper-label"]}>{label}</span>
      <span className={styles["stepper-controls"]}>
        {[...steps].reverse().map((step) => (
          <button
            key={`-${step}`}
            type="button"
            className={styles["step-btn"]}
            disabled={disabled || value <= bounds.min}
            aria-label={`${label} −${step}`}
            onClick={() => onStep(-step)}
          >
            −{step}
          </button>
        ))}
        <span className={styles["stepper-value"]}>
          {value}
          {suffix ? ` ${suffix}` : ""}
        </span>
        {steps.map((step) => (
          <button
            key={`+${step}`}
            type="button"
            className={styles["step-btn"]}
            disabled={disabled || value >= bounds.max}
            aria-label={`${label} +${step}`}
            onClick={() => onStep(step)}
          >
            +{step}
          </button>
        ))}
      </span>
    </div>
  );
}

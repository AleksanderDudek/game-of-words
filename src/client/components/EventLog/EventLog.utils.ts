import type { ServerMessage, Player } from "@/shared/types";

export interface EventLogProps {
  events: ServerMessage[];
  players: Player[];
}

export interface LogEntry {
  text: string;
  className: string;
}

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

export function resolvePlayerName(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? "???";
}

export function formatEvent(ev: ServerMessage, players: Player[], t: TFunc): LogEntry | null {
  const getName = (id: string) => resolvePlayerName(players, id);

  switch (ev.type) {
    case "guess_result":
      return {
        text: ev.correct
          ? t("eventLog.guessCorrect", { name: getName(ev.playerId) })
          : t("eventLog.guessWrong", { name: getName(ev.playerId), guess: ev.guess }),
        className: `log-entry ${ev.correct ? "correct" : "wrong"}`,
      };
    case "hint_revealed":
      return {
        text: t("eventLog.hintRevealed", { name: getName(ev.playerId) }),
        className: "log-entry hint",
      };
    case "round_won":
      return {
        text: ev.playerId
          ? t("eventLog.roundWon", { name: getName(ev.playerId), points: ev.points, word: ev.word })
          : t("eventLog.timeUp", { word: ev.word }),
        className: "log-entry win",
      };
    case "turn_switched":
      return {
        text: t("eventLog.turnSwitched", { name: getName(ev.newPlayerId) }),
        className: "log-entry turn",
      };
    case "steal_phase":
      return {
        text: t("eventLog.stealPhase", { team: t(`teams.${ev.team}`), seconds: ev.seconds }),
        className: "log-entry steal",
      };
    case "life_lost":
      return {
        text: t("eventLog.lifeLost", { word: ev.word, count: ev.livesLeft }),
        className: "log-entry error",
      };
    case "error":
      return {
        text: t("eventLog.error", { message: ev.message }),
        className: "log-entry error",
      };
    default:
      return null;
  }
}

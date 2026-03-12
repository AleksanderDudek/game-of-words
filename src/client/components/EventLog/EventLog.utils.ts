import type { ServerMessage, Player } from "@/shared/types";

export interface EventLogProps {
  events: ServerMessage[];
  players: Player[];
}

export interface LogEntry {
  text: string;
  className: string;
}

export function resolvePlayerName(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? "???";
}

export function formatEvent(ev: ServerMessage, players: Player[]): LogEntry | null {
  const getName = (id: string) => resolvePlayerName(players, id);

  switch (ev.type) {
    case "guess_result":
      return {
        text: ev.correct
          ? `✓ ${getName(ev.playerId)} guessed correctly!`
          : `✗ ${getName(ev.playerId)} guessed "${ev.guess}"`,
        className: `log-entry ${ev.correct ? "correct" : "wrong"}`,
      };
    case "hint_revealed":
      return {
        text: `🔓 ${getName(ev.playerId)} revealed a pair`,
        className: "log-entry hint",
      };
    case "round_won":
      return {
        text: ev.playerId
          ? `🏆 ${getName(ev.playerId)} solved it! (+${ev.points}) — "${ev.word}"`
          : `⏰ Time's up! The word was "${ev.word}"`,
        className: "log-entry win",
      };
    case "turn_switched":
      return {
        text: `↻ ${getName(ev.newPlayerId)}'s turn`,
        className: "log-entry turn",
      };
    case "error":
      return {
        text: `⚠ ${ev.message}`,
        className: "log-entry error",
      };
    default:
      return null;
  }
}

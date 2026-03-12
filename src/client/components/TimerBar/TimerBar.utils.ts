export interface TimerBarProps {
  timeLeft: number;
  total: number;
}

export function getTimerPercent(timeLeft: number, total: number): number {
  return Math.max(0, Math.min(100, (timeLeft / total) * 100));
}

export function isUrgent(pct: number): boolean {
  return pct < 25;
}

export function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

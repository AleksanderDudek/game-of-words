import { useEffect, useRef } from "react";
import styles from "./EventLog.module.scss";
import { formatEvent } from "./EventLog.utils";
import type { EventLogProps } from "./EventLog.utils";

export function EventLog({ events, players }: EventLogProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className={styles["event-log"]} ref={logRef}>
      {events.map((ev, i) => {
        const entry = formatEvent(ev, players);
        if (!entry) return null;

        const classNames = entry.className
          .split(" ")
          .map((c) => styles[c] ?? c)
          .join(" ");

        return (
          <div key={i} className={classNames}>
            {entry.text}
          </div>
        );
      })}
    </div>
  );
}

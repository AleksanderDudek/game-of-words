import styles from "./JoinScreen.module.scss";
import type { JoinScreenProps } from "./JoinScreen.types";

export function JoinScreen({
  connected,
  nameInput,
  sessionIdInput,
  onNameChange,
  onSessionIdChange,
  onJoin,
}: JoinScreenProps) {
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onJoin();
  };

  return (
    <div className={styles["join-screen"]}>
      <div className={styles["logo-section"]}>
        <div className={styles["logo-badge"]}>⚡</div>
        <h1 className={styles["logo-title"]}>SIGNAL DECAY</h1>
        <p className={styles["logo-subtitle"]}>
          Decode the scrambled signal before it's lost forever
        </p>
      </div>

      <div className={styles["join-form"]}>
        <div
          className={`${styles["connection-status"]} ${
            connected ? styles["online"] : styles["offline"]
          }`}
        >
          <div className={styles["status-dot"]} />
          {connected ? "Server connected" : "Connecting..."}
        </div>

        <div className={styles["input-group"]}>
          <label>CALLSIGN</label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Enter your name"
            maxLength={16}
            disabled={!connected}
          />
        </div>

        <div className={styles["input-group"]}>
          <label>
            SESSION CODE <span className={styles["optional"]}>(optional)</span>
          </label>
          <input
            type="text"
            value={sessionIdInput}
            onChange={(e) => onSessionIdChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Leave empty to auto-join"
            maxLength={8}
            disabled={!connected}
          />
        </div>

        <button
          className="btn primary"
          onClick={onJoin}
          disabled={!connected || !nameInput.trim()}
        >
          CONNECT →
        </button>
      </div>

      <div className={styles["rules-brief"]}>
        <h3>HOW IT WORKS</h3>
        <p>
          Words arrive with their <em>middle letters scrambled</em> — first and last
          stay put. Take turns guessing the original word. Spend points to reveal
          swapped pairs. Difficulty increases each round.
        </p>
      </div>
    </div>
  );
}

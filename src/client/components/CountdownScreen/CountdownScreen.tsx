import styles from "./CountdownScreen.module.scss";

export interface CountdownScreenProps {
  countdownLeft: number;
}

export function CountdownScreen({ countdownLeft }: CountdownScreenProps) {
  return (
    <div className={styles["countdown-screen"]}>
      <div className={styles["countdown-number"]}>{countdownLeft}</div>
      <div className={styles["countdown-label"]}>SIGNAL INCOMING</div>
    </div>
  );
}

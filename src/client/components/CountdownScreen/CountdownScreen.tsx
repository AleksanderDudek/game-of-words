import { useTranslation } from "react-i18next";
import styles from "./CountdownScreen.module.scss";

export interface CountdownScreenProps {
  countdownLeft: number;
}

export function CountdownScreen({ countdownLeft }: CountdownScreenProps) {
  const { t } = useTranslation();
  return (
    <div className={styles["countdown-screen"]}>
      <div className={styles["countdown-number"]}>{countdownLeft}</div>
      <div className={styles["countdown-label"]}>{t("countdown.label")}</div>
    </div>
  );
}

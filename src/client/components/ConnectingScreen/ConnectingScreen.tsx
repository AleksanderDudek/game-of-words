import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import styles from "./ConnectingScreen.module.scss";

interface Joke {
  setup: string;
  punchline: string;
}

const FALLBACK_JOKES_EN: Joke[] = [
  { setup: "Why do programmers prefer dark mode?", punchline: "Because light attracts bugs." },
  { setup: "What's a computer's favorite snack?", punchline: "Microchips." },
  { setup: "Why was the JavaScript developer sad?", punchline: "Because he didn't Node how to Express himself." },
  { setup: "What do you call a fake noodle?", punchline: "An impasta." },
  { setup: "Why don't scientists trust atoms?", punchline: "Because they make up everything." },
  { setup: "What did the ocean say to the shore?", punchline: "Nothing, it just waved." },
  { setup: "Why did the scarecrow win an award?", punchline: "Because he was outstanding in his field." },
  { setup: "What do you call a bear with no teeth?", punchline: "A gummy bear." },
];

const ROTATE_INTERVAL = 8_000;
const PUNCHLINE_DELAY = 3_000;
const JOKE_API = "https://official-joke-api.appspot.com/jokes/random/10";

export function ConnectingScreen() {
  const { t } = useTranslation();
  const localizedFallback = (t("connecting.jokes", { returnObjects: true }) as Joke[]);
  const fallbackJokes = Array.isArray(localizedFallback) && localizedFallback.length > 0
    ? localizedFallback
    : FALLBACK_JOKES_EN;
  const [jokes, setJokes] = useState<Joke[]>(fallbackJokes);
  const [jokeIndex, setJokeIndex] = useState(0);
  const [showPunchline, setShowPunchline] = useState(false);
  const [dots, setDots] = useState(1);
  const fetched = useRef(false);

  // Fetch jokes from API once
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    const controller = new AbortController();
    fetch(JOKE_API, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: Array<{ setup: string; punchline: string }>) => {
        if (Array.isArray(data) && data.length > 0) {
          setJokes(data.map((j) => ({ setup: j.setup, punchline: j.punchline })));
          setJokeIndex(0);
          setShowPunchline(false);
        }
      })
      .catch(() => {
        /* use fallbacks */
      });

    return () => controller.abort();
  }, []);

  // Rotate jokes
  const nextJoke = useCallback(() => {
    setShowPunchline(false);
    setJokeIndex((i) => (i + 1) % jokes.length);
  }, [jokes.length]);

  useEffect(() => {
    const punchTimer = setTimeout(() => setShowPunchline(true), PUNCHLINE_DELAY);
    const rotateTimer = setTimeout(nextJoke, ROTATE_INTERVAL);
    return () => {
      clearTimeout(punchTimer);
      clearTimeout(rotateTimer);
    };
  }, [jokeIndex, nextJoke]);

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => setDots((d) => (d % 3) + 1), 500);
    return () => clearInterval(interval);
  }, []);

  const joke = jokes[jokeIndex];

  return (
    <div className={styles["connecting-screen"]}>
      <div className={styles["signal-icon"]}>📡</div>
      <h2 className={styles["connecting-title"]}>
        {t("connecting.title")}{"." .repeat(dots)}
      </h2>
      <p className={styles["connecting-hint"]}>
        {t("connecting.hint")}
      </p>

      <div className={styles["progress-bar"]}>
        <div className={styles["progress-fill"]} />
      </div>

      <div className={styles["joke-card"]}>
        <div className={styles["joke-label"]}>{t("connecting.whileYouWait")}</div>
        <p className={styles["joke-setup"]}>{joke.setup}</p>
        <p
          className={`${styles["joke-punchline"]} ${
            showPunchline ? styles["visible"] : ""
          }`}
        >
          {joke.punchline}
        </p>
      </div>

      <div className={styles["counter"]}>
        {jokeIndex + 1} / {jokes.length}
      </div>
    </div>
  );
}

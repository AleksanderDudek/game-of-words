import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useGameSocket } from "./hooks/useGameSocket/useGameSocket";
import { JoinScreen } from "./components/JoinScreen/JoinScreen";
import { LobbyScreen } from "./components/LobbyScreen/LobbyScreen";
import { CountdownScreen } from "./components/CountdownScreen/CountdownScreen";
import { GameScreen } from "./components/GameScreen/GameScreen";
import { GameOverScreen } from "./components/GameOverScreen/GameOverScreen";
import { ServerSelectScreen } from "./components/ServerSelectScreen/ServerSelectScreen";
import { ConnectingScreen } from "./components/ConnectingScreen/ConnectingScreen";
import { SINGLE_SERVER_URL, GAME_SERVERS } from "./config/servers";
import type { GameServerEntry } from "@/shared/types";
import "./styles/global.scss";

/** True when a single WS URL is configured (Docker Compose / dev mode) */
const isSingleServerMode = Boolean(SINGLE_SERVER_URL);

export default function App() {
  const [selectedServer, setSelectedServer] = useState<GameServerEntry | null>(null);

  // Determine WebSocket URL: single-server mode → env var; multi-server → user selection
  const wsUrl = isSingleServerMode
    ? SINGLE_SERVER_URL!
    : selectedServer?.url ?? null;

  const { session, playerId, connected, events, join, send, forfeitGame } = useGameSocket({
    serverUrl: wsUrl,
  });
  const [nameInput, setNameInput] = useState("");
  const [sessionIdInput, setSessionIdInput] = useState("");
  const [guessInput, setGuessInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isHost = session?.hostId === playerId;

  const isMyTurn = useMemo(
    () => session?.round?.currentPlayerId === playerId,
    [session, playerId]
  );

  useEffect(() => {
    if (isMyTurn && session?.state === "playing") {
      inputRef.current?.focus();
    }
  }, [isMyTurn, session?.state]);

  const handleJoin = () => {
    if (!nameInput.trim()) return;
    join(nameInput.trim(), sessionIdInput.trim() || undefined);
  };

  const handleGuess = () => {
    if (!guessInput.trim() || !isMyTurn) return;
    send({ type: "guess", word: guessInput.trim() });
    setGuessInput("");
  };

  const handleBuyHint = () => {
    send({ type: "buy_hint" });
  };

  const handlePassTurn = () => send({ type: "pass_turn" });
  const handlePauseGame = () => send({ type: "pause_game" });
  const handleResumeGame = () => send({ type: "resume_game" });

  const handleServerSelect = useCallback((server: GameServerEntry) => {
    setSelectedServer(server);
  }, []);

  // ─── Server Selection (multi-server mode only) ───
  if (!isSingleServerMode && !selectedServer) {
    return (
      <div className="app">
        <div className="screen">
          <ServerSelectScreen servers={GAME_SERVERS} onSelect={handleServerSelect} />
        </div>
      </div>
    );
  }

  // ─── Connecting screen (waiting for cold-start wake-up) ───
  if (wsUrl && !connected) {
    return (
      <div className="app">
        <div className="screen">
          <ConnectingScreen />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app">
        <div className="screen">
          <JoinScreen
            connected={connected}
            nameInput={nameInput}
            sessionIdInput={sessionIdInput}
            onNameChange={setNameInput}
            onSessionIdChange={setSessionIdInput}
            onJoin={handleJoin}
          />
        </div>
      </div>
    );
  }

  if (session.state === "lobby") {
    return (
      <div className="app">
        <div className="screen">
          <LobbyScreen
            session={session}
            playerId={playerId}
            onStartGame={() => send({ type: "start_game" })}
          />
        </div>
      </div>
    );
  }

  if (session.state === "countdown") {
    return (
      <div className="app">
        <div className="screen">
          <CountdownScreen countdownLeft={session.countdownLeft ?? 0} />
        </div>
      </div>
    );
  }

  if (session.state === "game_over") {
    return (
      <div className="app">
        <div className="screen">
          <GameOverScreen
            players={session.players}
            playerId={playerId}
            onNewGame={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  // playing | round_end | paused
  return (
    <div className="app">
      <div className="screen">
        <GameScreen
          session={session}
          playerId={playerId}
          events={events}
          guessInput={guessInput}
          onGuessChange={setGuessInput}
          onGuess={handleGuess}
          onBuyHint={handleBuyHint}
          onPassTurn={handlePassTurn}
          onPauseGame={handlePauseGame}
          onResumeGame={handleResumeGame}
          onForfeitGame={forfeitGame}
          isHost={isHost}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
}

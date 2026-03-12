import { useState, useEffect, useRef, useMemo } from "react";
import { useGameSocket } from "./useGameSocket";
import { ServerMessage, LetterCell, Player } from "./types";
import "./styles.css";

// ─── Subcomponents ───

function BoardCell({ cell, index }: { cell: LetterCell; index: number }) {
  const cls = [
    "board-cell",
    cell.isFixed ? "fixed" : "",
    cell.isRevealed ? "revealed" : "",
    !cell.isFixed && !cell.isRevealed && cell.swappedWith !== null ? "swapped" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} style={{ animationDelay: `${index * 40}ms` }}>
      <span className="cell-char">{cell.current}</span>
      <span className="cell-index">{index}</span>
    </div>
  );
}

function TimerBar({ timeLeft, total }: { timeLeft: number; total: number }) {
  const pct = (timeLeft / total) * 100;
  const urgent = pct < 25;
  return (
    <div className="timer-bar-track">
      <div
        className={`timer-bar-fill ${urgent ? "urgent" : ""}`}
        style={{ width: `${pct}%` }}
      />
      <span className="timer-bar-text">
        {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
      </span>
    </div>
  );
}

function PlayerCard({
  player,
  isCurrent,
  isYou,
}: {
  player: Player;
  isCurrent: boolean;
  isYou: boolean;
}) {
  return (
    <div className={`player-card ${isCurrent ? "current" : ""} ${isYou ? "you" : ""}`}>
      <div className="player-indicator">
        <div className={`player-dot ${player.isConnected ? "online" : "offline"}`} />
        {isCurrent && <span className="turn-arrow">▸</span>}
      </div>
      <div className="player-info">
        <span className="player-name">
          {player.name}
          {isYou && <span className="you-badge">YOU</span>}
        </span>
        <span className="player-score">{player.score} pts</span>
      </div>
    </div>
  );
}

function EventLog({ events, players }: { events: ServerMessage[]; players: Player[] }) {
  const logRef = useRef<HTMLDivElement>(null);
  const getName = (id: string) => players.find((p) => p.id === id)?.name || "???";

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [events]);

  return (
    <div className="event-log" ref={logRef}>
      {events.map((ev, i) => {
        let text = "";
        let cls = "log-entry";
        switch (ev.type) {
          case "guess_result":
            text = ev.correct
              ? `✓ ${getName(ev.playerId)} guessed correctly!`
              : `✗ ${getName(ev.playerId)} guessed "${ev.guess}"`;
            cls += ev.correct ? " correct" : " wrong";
            break;
          case "hint_revealed":
            text = `🔓 ${getName(ev.playerId)} revealed a pair`;
            cls += " hint";
            break;
          case "round_won":
            text = ev.playerId
              ? `🏆 ${getName(ev.playerId)} solved it! (+${ev.points}) — "${ev.word}"`
              : `⏰ Time's up! The word was "${ev.word}"`;
            cls += " win";
            break;
          case "turn_switched":
            text = `↻ ${getName(ev.newPlayerId)}'s turn`;
            cls += " turn";
            break;
          case "error":
            text = `⚠ ${ev.message}`;
            cls += " error";
            break;
          default:
            return null;
        }
        return (
          <div key={i} className={cls}>
            {text}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main App ───

export default function App() {
  const { session, playerId, connected, events, join, send } = useGameSocket();
  const [nameInput, setNameInput] = useState("");
  const [sessionIdInput, setSessionIdInput] = useState("");
  const [guessInput, setGuessInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isMyTurn = useMemo(
    () => session?.round?.currentPlayerId === playerId,
    [session, playerId]
  );

  // Auto-focus guess input on turn change
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

  const me = session?.players.find((p) => p.id === playerId);

  // ─── Not connected / Not joined ───
  if (!session) {
    return (
      <div className="app">
        <div className="screen join-screen">
          <div className="logo-section">
            <div className="logo-badge">⚡</div>
            <h1 className="logo-title">SIGNAL DECAY</h1>
            <p className="logo-subtitle">
              Decode the scrambled signal before it's lost forever
            </p>
          </div>

          <div className="join-form">
            <div className={`connection-status ${connected ? "online" : "offline"}`}>
              <div className="status-dot" />
              {connected ? "Server connected" : "Connecting..."}
            </div>

            <div className="input-group">
              <label>CALLSIGN</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="Enter your name"
                maxLength={16}
                disabled={!connected}
              />
            </div>

            <div className="input-group">
              <label>SESSION CODE <span className="optional">(optional)</span></label>
              <input
                type="text"
                value={sessionIdInput}
                onChange={(e) => setSessionIdInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="Leave empty to auto-join"
                maxLength={8}
                disabled={!connected}
              />
            </div>

            <button
              className="btn primary"
              onClick={handleJoin}
              disabled={!connected || !nameInput.trim()}
            >
              CONNECT →
            </button>
          </div>

          <div className="rules-brief">
            <h3>HOW IT WORKS</h3>
            <p>
              Words arrive with their <em>middle letters scrambled</em> — first and
              last stay put. Take turns guessing the original word. Spend points to
              reveal swapped pairs. Difficulty increases each round.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Lobby ───
  if (session.state === "lobby") {
    return (
      <div className="app">
        <div className="screen lobby-screen">
          <div className="session-header">
            <span className="session-label">SESSION</span>
            <span className="session-code">{session.sessionId}</span>
          </div>

          <h2 className="lobby-title">Waiting for players...</h2>
          <p className="lobby-hint">
            Share the session code with friends to join
          </p>

          <div className="player-list">
            {session.players.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                isCurrent={false}
                isYou={p.id === playerId}
              />
            ))}
          </div>

          <div className="lobby-config">
            <div className="config-item">
              <span>Words</span>
              <span>{session.config.minWordLength}→{session.config.maxWordLength} letters</span>
            </div>
            <div className="config-item">
              <span>Turn guesses</span>
              <span>{session.config.turnsPerPlayer}</span>
            </div>
            <div className="config-item">
              <span>Round time</span>
              <span>{session.config.sessionDurationSec}s</span>
            </div>
            <div className="config-item">
              <span>Hint cost</span>
              <span>{session.config.hintCostPoints} pts</span>
            </div>
          </div>

          {session.players.length >= 2 && (
            <button
              className="btn primary"
              onClick={() => send({ type: "start_game" })}
            >
              START GAME
            </button>
          )}

          {session.players.length < 2 && (
            <div className="waiting-dots">
              Need at least 2 players
              <span className="dots-anim">...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Countdown ───
  if (session.state === "countdown") {
    return (
      <div className="app">
        <div className="screen countdown-screen">
          <div className="countdown-number">{session.countdownLeft}</div>
          <div className="countdown-label">SIGNAL INCOMING</div>
        </div>
      </div>
    );
  }

  // ─── Game Over ───
  if (session.state === "game_over") {
    const sorted = [...session.players].sort((a, b) => b.score - a.score);
    return (
      <div className="app">
        <div className="screen gameover-screen">
          <h1 className="gameover-title">SIGNAL LOST</h1>
          <p className="gameover-subtitle">Final Standings</p>

          <div className="leaderboard">
            {sorted.map((p, i) => (
              <div key={p.id} className={`lb-row ${i === 0 ? "winner" : ""}`}>
                <span className="lb-rank">#{i + 1}</span>
                <span className="lb-name">
                  {p.name}
                  {p.id === playerId && <span className="you-badge">YOU</span>}
                </span>
                <span className="lb-score">{p.score}</span>
              </div>
            ))}
          </div>

          <button className="btn primary" onClick={() => window.location.reload()}>
            NEW GAME
          </button>
        </div>
      </div>
    );
  }

  // ─── Playing / Round End ───
  const round = session.round!;
  const canAffordHint = (me?.score ?? 0) >= session.config.hintCostPoints;

  return (
    <div className="app">
      <div className="screen game-screen">
        {/* Top bar */}
        <div className="game-topbar">
          <div className="session-badge">
            <span className="session-label">SESSION</span>
            <span className="session-code">{session.sessionId}</span>
          </div>
          <div className="round-badge">
            ROUND {round.roundNumber}
            <span className="difficulty-tag">{round.wordLength} letters</span>
          </div>
        </div>

        {/* Timer */}
        <TimerBar timeLeft={round.timeLeft} total={session.config.sessionDurationSec} />

        {/* Hint */}
        <div className="hint-box">
          <span className="hint-label">HINT</span>
          <span className="hint-text">{round.hint}</span>
        </div>

        {/* Board */}
        <div className="board">
          {round.board.map((cell, i) => (
            <BoardCell key={i} cell={cell} index={i} />
          ))}
        </div>

        {/* Turn indicator */}
        <div className={`turn-indicator ${isMyTurn ? "your-turn" : ""}`}>
          {session.state === "round_end" ? (
            <span className="round-end-msg">Next round starting...</span>
          ) : isMyTurn ? (
            <>
              <span className="turn-text">YOUR TURN</span>
              <span className="turns-left">
                {round.turnsRemaining} guess{round.turnsRemaining !== 1 ? "es" : ""} left
              </span>
            </>
          ) : (
            <span className="turn-text">
              {session.players.find((p) => p.id === round.currentPlayerId)?.name}'s turn
            </span>
          )}
        </div>

        {/* Guess input */}
        {session.state === "playing" && (
          <div className="guess-area">
            <div className="guess-input-row">
              <input
                ref={inputRef}
                type="text"
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGuess()}
                placeholder={isMyTurn ? "Type your guess..." : "Waiting for your turn..."}
                disabled={!isMyTurn}
                className="guess-input"
              />
              <button
                className="btn primary guess-btn"
                onClick={handleGuess}
                disabled={!isMyTurn || !guessInput.trim()}
              >
                GUESS
              </button>
            </div>
            <button
              className="btn hint-btn"
              onClick={handleBuyHint}
              disabled={!canAffordHint}
              title={`Costs ${session.config.hintCostPoints} points`}
            >
              🔓 REVEAL PAIR ({session.config.hintCostPoints} pts)
            </button>
          </div>
        )}

        {/* Bottom panel: players + log */}
        <div className="bottom-panel">
          <div className="players-panel">
            {session.players.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                isCurrent={p.id === round.currentPlayerId}
                isYou={p.id === playerId}
              />
            ))}
          </div>
          <EventLog events={events} players={session.players} />
        </div>
      </div>
    </div>
  );
}

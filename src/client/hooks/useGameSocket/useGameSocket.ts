import { useEffect, useRef, useState, useCallback } from "react";
import { ClientMessage, ServerMessage, SessionSnapshot } from "@/shared/types";

const FALLBACK_WS_URL = `ws://${window.location.hostname}:8080`;

const STORAGE_KEY = "signal-decay-session";

interface StoredSession {
  playerId: string;
  sessionId: string;
  playerName: string;
}

function loadStored(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function saveStored(data: StoredSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

function clearStored(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export interface UseGameSocketOptions {
  /** WebSocket URL to connect to. Pass undefined/null to defer connection. */
  serverUrl?: string | null;
}

export interface UseGameSocket {
  session: SessionSnapshot | null;
  playerId: string | null;
  sessionId: string | null;
  connected: boolean;
  events: ServerMessage[];
  join: (name: string, sessionId?: string) => void;
  send: (msg: ClientMessage) => void;
  clearEvents: () => void;
  forfeitGame: () => void;
}

export function useGameSocket(options: UseGameSocketOptions = {}): UseGameSocket {
  const { serverUrl = FALLBACK_WS_URL } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<ServerMessage[]>([]);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerNameRef = useRef<string>("");
  const serverUrlRef = useRef(serverUrl);
  serverUrlRef.current = serverUrl;

  const connect = useCallback(() => {
    const url = serverUrlRef.current;
    if (!url) return; // no URL = don't connect yet
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      // Auto-rejoin if stored credentials exist (e.g. after a crash/tab close)
      const stored = loadStored();
      if (stored) {
        playerNameRef.current = stored.playerName;
        ws.send(
          JSON.stringify({
            type: "join",
            name: stored.playerName,
            sessionId: stored.sessionId,
            playerId: stored.playerId,
          } satisfies ClientMessage)
        );
      }
    };

    ws.onmessage = (ev) => {
      const msg: ServerMessage = JSON.parse(ev.data as string);

      switch (msg.type) {
        case "joined":
          setPlayerId(msg.playerId);
          setSessionId(msg.sessionId);
          saveStored({
            playerId: msg.playerId,
            sessionId: msg.sessionId,
            playerName: playerNameRef.current,
          });
          break;
        case "session_update":
          setSession(msg.session);
          break;
        case "guess_result":
        case "hint_revealed":
        case "round_won":
        case "turn_switched":
        case "player_joined":
        case "player_left":
        case "game_paused":
        case "game_resumed":
        case "error":
          setEvents((prev) => [...prev.slice(-20), msg]);
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const join = useCallback(
    (name: string, targetSessionId?: string) => {
      playerNameRef.current = name;
      send({ type: "join", name, sessionId: targetSessionId });
    },
    [send]
  );

  const forfeitGame = useCallback(() => {
    send({ type: "forfeit_game" });
    clearStored();
    setSession(null);
    setPlayerId(null);
    setSessionId(null);
  }, [send]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { session, playerId, sessionId, connected, events, join, send, clearEvents, forfeitGame };
}

import { useEffect, useRef, useState, useCallback } from "react";
import { ClientMessage, ServerMessage, SessionSnapshot } from "@/shared/types";

const WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:8080`;

export interface UseGameSocket {
  session: SessionSnapshot | null;
  playerId: string | null;
  connected: boolean;
  events: ServerMessage[];
  join: (name: string, sessionId?: string) => void;
  send: (msg: ClientMessage) => void;
  clearEvents: () => void;
}

export function useGameSocket(): UseGameSocket {
  const wsRef = useRef<WebSocket | null>(null);
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<ServerMessage[]>([]);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onmessage = (ev) => {
      const msg: ServerMessage = JSON.parse(ev.data as string);

      switch (msg.type) {
        case "joined":
          setPlayerId(msg.playerId);
          break;
        case "session_update":
          setSession(msg.session);
          break;
        case "guess_result":
        case "hint_revealed":
        case "round_won":
        case "turn_switched":
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
    (name: string, sessionId?: string) => {
      send({ type: "join", name, sessionId });
    },
    [send]
  );

  const clearEvents = useCallback(() => setEvents([]), []);

  return { session, playerId, connected, events, join, send, clearEvents };
}

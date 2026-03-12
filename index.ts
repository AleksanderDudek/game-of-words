// ═══════════════════════════════════════════════════════════════
// SIGNAL DECAY — WebSocket Server
// ═══════════════════════════════════════════════════════════════

import { WebSocketServer, WebSocket } from "ws";
import { CONFIG } from "./config";
import { GameSession } from "./session";
import { ClientMessage } from "./types";

const sessions = new Map<string, GameSession>();
const playerSessions = new Map<WebSocket, { sessionId: string; playerId: string }>();

function findOrCreateSession(): GameSession {
  // Find an open lobby session
  for (const session of sessions.values()) {
    if (session.state === "lobby" && session.players.size < CONFIG.MAX_PLAYERS) {
      return session;
    }
  }

  // Check concurrent session limit
  const activeSessions = [...sessions.values()].filter(
    (s) => s.state !== "game_over"
  );
  if (activeSessions.length >= CONFIG.MAX_CONCURRENT_SESSIONS) {
    throw new Error("Server full — max concurrent sessions reached");
  }

  // Create new session
  const session = new GameSession();
  sessions.set(session.id, session);
  console.log(`[Server] New session created: ${session.id} (total: ${sessions.size})`);
  return session;
}

function getSession(sessionId: string): GameSession | undefined {
  return sessions.get(sessionId);
}

// ─── Start Server ───
const wss = new WebSocketServer({ port: CONFIG.WS_PORT });

console.log(`
╔══════════════════════════════════════════════════╗
║           ⚡ SIGNAL DECAY SERVER ⚡              ║
║                                                  ║
║   WebSocket listening on ws://localhost:${CONFIG.WS_PORT}    ║
║   Max sessions: ${String(CONFIG.MAX_CONCURRENT_SESSIONS).padEnd(33)}║
║   Word length: ${CONFIG.MIN_WORD_LENGTH} → ${String(CONFIG.MAX_WORD_LENGTH).padEnd(30)}║
║   LLM endpoint: ${(CONFIG.LLM_ENDPOINT || "(fallback word bank)").slice(0, 30).padEnd(31)}║
║                                                  ║
╚══════════════════════════════════════════════════╝
`);

wss.on("connection", (ws: WebSocket) => {
  console.log(`[Server] New WebSocket connection`);

  ws.on("message", (raw: Buffer) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    // ─── Handle join ───
    if (msg.type === "join") {
      try {
        let session: GameSession;
        if (msg.sessionId) {
          const existing = getSession(msg.sessionId);
          if (!existing) {
            ws.send(JSON.stringify({ type: "error", message: "Session not found" }));
            return;
          }
          session = existing;
        } else {
          session = findOrCreateSession();
        }

        const playerId = session.addPlayer(ws, msg.name);
        if (playerId) {
          playerSessions.set(ws, { sessionId: session.id, playerId });
        }
      } catch (err: any) {
        ws.send(JSON.stringify({ type: "error", message: err.message }));
      }
      return;
    }

    // ─── Route other messages to session ───
    const binding = playerSessions.get(ws);
    if (!binding) {
      ws.send(JSON.stringify({ type: "error", message: "Not in a session. Send join first." }));
      return;
    }

    const session = sessions.get(binding.sessionId);
    if (!session) {
      ws.send(JSON.stringify({ type: "error", message: "Session expired" }));
      return;
    }

    session.handleMessage(binding.playerId, msg);
  });

  ws.on("close", () => {
    const binding = playerSessions.get(ws);
    if (binding) {
      const session = sessions.get(binding.sessionId);
      if (session) {
        session.removePlayer(binding.playerId);

        // Clean up empty sessions
        const connected = [...session.players.values()].filter((p) => p.isConnected);
        if (connected.length === 0) {
          sessions.delete(session.id);
          console.log(`[Server] Session ${session.id} removed (empty). Total: ${sessions.size}`);
        }
      }
      playerSessions.delete(ws);
    }
  });

  ws.on("error", (err) => {
    console.error("[Server] WebSocket error:", err.message);
  });
});

// ─── Periodic cleanup of stale sessions ───
setInterval(() => {
  for (const [id, session] of sessions) {
    if (session.state === "game_over") {
      const connected = [...session.players.values()].filter((p) => p.isConnected);
      if (connected.length === 0) {
        session.cleanup();
        sessions.delete(id);
        console.log(`[Server] Cleaned stale session ${id}`);
      }
    }
  }
}, 30000);

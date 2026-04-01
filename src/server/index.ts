// ═══════════════════════════════════════════════════════════════
// SIGNAL DECAY — WebSocket + REST Server
// ═══════════════════════════════════════════════════════════════

import http, { IncomingMessage, ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { CONFIG } from "./config";
import { GameSession } from "./session";
import { isClientMessage, toPlayerId } from "../shared/types";
import type { ServerInfo } from "../shared/types";

const sessions = new Map<string, GameSession>();
const playerSessions = new Map<WebSocket, { sessionId: string; playerId: string }>();

// ─── Rate limiting (per-connection message counter) ───
const messageCounts = new Map<WebSocket, { count: number; resetAt: number }>();

function isRateLimited(ws: WebSocket): boolean {
  const now = Date.now();
  let entry = messageCounts.get(ws);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + 1000 };
    messageCounts.set(ws, entry);
  }
  entry.count++;
  return entry.count > CONFIG.RATE_LIMIT_MSG_PER_SEC;
}

// ─── Origin validation ───
function isOriginAllowed(req: IncomingMessage): boolean {
  if (!CONFIG.ALLOWED_ORIGINS) return true; // empty = allow all (dev mode)
  const origin = req.headers.origin ?? "";
  const allowed = CONFIG.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  return allowed.includes(origin);
}

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

// ─── REST API Handler ───
function handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
  // CORS headers for cross-origin server info requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", region: CONFIG.REGION }));
    return;
  }

  if (req.method === "GET" && req.url === "/api/info") {
    const activeSessionList = [...sessions.values()].filter((s) => s.state !== "game_over");
    const totalPlayers = activeSessionList.reduce(
      (sum, s) => sum + [...s.players.values()].filter((p) => p.isConnected).length,
      0,
    );
    const info: ServerInfo = {
      region: CONFIG.REGION,
      name: CONFIG.SERVER_NAME,
      activeSessions: activeSessionList.length,
      totalPlayers,
      maxSessions: CONFIG.MAX_CONCURRENT_SESSIONS,
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(info));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
}

// ─── Start HTTP + WebSocket Server ───
const httpServer = http.createServer(handleHttpRequest);

const wss = new WebSocketServer({
  server: httpServer,
  verifyClient: (info: { req: IncomingMessage }) => isOriginAllowed(info.req),
});

console.log(`
╔══════════════════════════════════════════════════╗
║           ⚡ SIGNAL DECAY SERVER ⚡              ║
║                                                  ║
║   Listening on :${String(CONFIG.WS_PORT).padEnd(33)}║
║   Region: ${CONFIG.REGION.padEnd(38)}║
║   Server: ${CONFIG.SERVER_NAME.padEnd(38)}║
║   Max sessions: ${String(CONFIG.MAX_CONCURRENT_SESSIONS).padEnd(33)}║
║   Word length: ${CONFIG.MIN_WORD_LENGTH} → ${String(CONFIG.MAX_WORD_LENGTH).padEnd(30)}║
║   LLM endpoint: ${(CONFIG.LLM_ENDPOINT || "(fallback word bank)").slice(0, 30).padEnd(31)}║
║                                                  ║
╚══════════════════════════════════════════════════╝
`);

wss.on("connection", (ws: WebSocket) => {
  console.log(`[Server] New WebSocket connection`);

  ws.on("message", (raw: Buffer) => {
    // ─── Rate limiting ───
    if (isRateLimited(ws)) {
      ws.send(JSON.stringify({ type: "error", message: "Rate limit exceeded" }));
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    // ─── Type guard validation ───
    if (!isClientMessage(parsed)) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid message type" }));
      return;
    }
    const msg = parsed;

    // ─── Input validation ───
    if (msg.type === "join") {
      if (!msg.name || typeof msg.name !== "string" || msg.name.trim().length === 0) {
        ws.send(JSON.stringify({ type: "error", message: "Name is required" }));
        return;
      }
      if (msg.name.length > CONFIG.MAX_NAME_LENGTH) {
        ws.send(JSON.stringify({ type: "error", message: `Name must be ${CONFIG.MAX_NAME_LENGTH} characters or fewer` }));
        return;
      }
    }
    if (msg.type === "guess") {
      if (!msg.word || typeof msg.word !== "string" || msg.word.trim().length === 0) {
        ws.send(JSON.stringify({ type: "error", message: "Guess cannot be empty" }));
        return;
      }
      if (msg.word.length > CONFIG.MAX_GUESS_LENGTH) {
        ws.send(JSON.stringify({ type: "error", message: `Guess must be ${CONFIG.MAX_GUESS_LENGTH} characters or fewer` }));
        return;
      }
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

        const playerId = session.addPlayer(ws, msg.name, msg.playerId);
        if (playerId) {
          playerSessions.set(ws, { sessionId: session.id, playerId });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        ws.send(JSON.stringify({ type: "error", message }));
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

    session.handleMessage(toPlayerId(binding.playerId), msg);
  });

  ws.on("close", () => {
    messageCounts.delete(ws);
    const binding = playerSessions.get(ws);
    if (binding) {
      const session = sessions.get(binding.sessionId);
      if (session) {
        session.removePlayer(toPlayerId(binding.playerId));

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

httpServer.listen(CONFIG.WS_PORT);

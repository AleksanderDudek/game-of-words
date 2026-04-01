import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGameSocket } from "./useGameSocket";
import type { ServerMessage, SessionId } from "@/shared/types";

// ─── Mock WebSocket ───

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sentMessages: string[] = [];

  constructor(public url: string) {
    MockWebSocket.lastInstance = this;
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(msg: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }

  static lastInstance: MockWebSocket;
}

vi.stubGlobal("WebSocket", MockWebSocket);

describe("useGameSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts disconnected", () => {
    const { result } = renderHook(() => useGameSocket());
    expect(result.current.connected).toBe(false);
  });

  it("becomes connected when WebSocket opens", () => {
    const { result } = renderHook(() => useGameSocket());
    act(() => {
      MockWebSocket.lastInstance.simulateOpen();
    });
    expect(result.current.connected).toBe(true);
  });

  it("sets playerId on joined message", () => {
    const { result } = renderHook(() => useGameSocket());
    act(() => {
      MockWebSocket.lastInstance.simulateOpen();
      MockWebSocket.lastInstance.simulateMessage({
        type: "joined",
        playerId: "abc123",
        sessionId: "sess1",
      });
    });
    expect(result.current.playerId).toBe("abc123");
  });

  it("updates session on session_update message", () => {
    const { result } = renderHook(() => useGameSocket());
    act(() => {
      MockWebSocket.lastInstance.simulateOpen();
      MockWebSocket.lastInstance.simulateMessage({
        type: "session_update",
        session: {
          sessionId: "sess1" as SessionId,
          state: "lobby",
          players: [],
          round: null,
          config: {
            pointsPerCorrect: 100,
            hintCostPoints: 30,
            turnsPerPlayer: 3,
            sessionDurationSec: 45,
            minWordLength: 4,
            maxWordLength: 10,
          },
        },
      });
    });
    expect(result.current.session?.sessionId).toBe("sess1");
  });

  it("accumulates events for guess_result, error etc", () => {
    const { result } = renderHook(() => useGameSocket());
    act(() => {
      MockWebSocket.lastInstance.simulateOpen();
      MockWebSocket.lastInstance.simulateMessage({
        type: "error",
        message: "Not your turn",
      });
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].type).toBe("error");
  });

  it("send sends JSON over WebSocket", () => {
    const { result } = renderHook(() => useGameSocket());
    act(() => {
      MockWebSocket.lastInstance.simulateOpen();
      result.current.send({ type: "ping" });
    });
    expect(MockWebSocket.lastInstance.sentMessages).toContain(
      JSON.stringify({ type: "ping" })
    );
  });

  it("join sends join message", () => {
    const { result } = renderHook(() => useGameSocket());
    act(() => {
      MockWebSocket.lastInstance.simulateOpen();
      result.current.join("Alice", "sess1");
    });
    expect(MockWebSocket.lastInstance.sentMessages).toContain(
      JSON.stringify({ type: "join", name: "Alice", sessionId: "sess1" })
    );
  });

  it("clearEvents empties the events array", () => {
    const { result } = renderHook(() => useGameSocket());
    act(() => {
      MockWebSocket.lastInstance.simulateOpen();
      MockWebSocket.lastInstance.simulateMessage({ type: "error", message: "oops" });
    });
    expect(result.current.events).toHaveLength(1);
    act(() => {
      result.current.clearEvents();
    });
    expect(result.current.events).toHaveLength(0);
  });
});

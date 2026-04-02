<div align="center">

# ⚡ Signal Decay

**A real-time multiplayer word-unscramble duel over WebSockets**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![WebSocket](https://img.shields.io/badge/WebSocket-RFC_6455-4ade80)](https://datatracker.ietf.org/doc/html/rfc6455)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed?logo=docker&logoColor=white)](https://docker.com/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

Words arrive with their middle letters scrambled. Race to decode the signal before it's lost forever.

🕹️ **[Play now → aleksanderdudek.github.io/game-of-words](https://aleksanderdudek.github.io/game-of-words/)**

[Play Now](#-play-now) · [Quick Start](#-quick-start) · [How to Play](#-how-to-play) · [Configuration](#-configuration) · [LLM Integration](#-pluggable-llm-endpoint) · [Docker](#-docker-deployment) · [Architecture](#-architecture)

</div>

---

## 🕹️ Play Now

The game is live at **https://aleksanderdudek.github.io/game-of-words/**

### Playing with 2 people

1. Both players open **https://aleksanderdudek.github.io/game-of-words/**
2. Wait for the server to connect (free tier may take ~30s on first visit — enjoy the jokes!)
3. **Player 1** enters a callsign and clicks **Connect** — note the **Session Code** shown in the lobby
4. **Player 2** enters their callsign, pastes the session code into the *Session Code* field, and clicks **Connect**
5. Once both are in the lobby, either player clicks **Start Game**

### Playing solo (testing / demo)

You can simulate a 2-player game from a single machine:

1. Open **https://aleksanderdudek.github.io/game-of-words/** in a normal window
2. Open the **same URL in an Incognito / Private window** (Cmd+Shift+N in Chrome)
3. In the normal window: enter a callsign → Connect → copy the **Session Code**
4. In the Incognito window: enter a different callsign → paste the Session Code → Connect
5. Both tabs are now in the same game — you can play both sides by switching tabs

> **Tip:** keep both windows side-by-side so you can see each player's view simultaneously.

> **Note:** The game server runs on Render's free tier. It sleeps after 15 minutes of inactivity. The first connection wakes it up (~30s), after which it responds instantly.

---

## 🎮 How to Play

1. **Join a session** — Enter a callsign and optionally a session code to join friends
2. **Read the board** — The word is displayed with its **middle letters shuffled**. First and last characters (and special chars like `-`) stay fixed
3. **Read the hint** — A witty, non-obvious clue is shown to guide your guess
4. **Take turns guessing** — Each player gets a set number of guesses per turn, then it switches
5. **Buy reveals** — Spend earned points to uncover a swapped pair (letters snap back to their correct positions)
6. **Score** — Correct guess = base points + time bonus + remaining-pairs bonus
7. **Difficulty ramps** — Word length increases from 4 to 20+ letters as rounds progress

> Swapped pairs never consist of identical letters — every shuffle is meaningful.

---

## 🚀 Quick Start

### Local Development (two terminals)

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/signal-decay.git
cd signal-decay

# Terminal 1: Server
cd server && npm install && npx ts-node src/index.ts

# Terminal 2: Client
cd client && npm install && npx vite --host
```

Open **http://localhost:5173** in 2+ browser tabs and start playing.

### Docker (one command)

```bash
docker compose up --build
```

Open **http://localhost:3000** — the server runs on port 8080 behind the scenes.

---

## ⚙️ Configuration

All game parameters are configurable via environment variables (or by editing `server/src/config.ts`):

| Variable | Default | Description |
|---|---|---|
| `WS_PORT` | `8080` | WebSocket server port |
| `MAX_CONCURRENT_SESSIONS` | `10` | Max simultaneous game rooms |
| `MIN_WORD_LENGTH` | `4` | Starting word difficulty |
| `MAX_WORD_LENGTH` | `20` | Maximum word difficulty |
| `WORDS_PER_DIFFICULTY` | `2` | Rounds before difficulty increases |
| `POINTS_PER_CORRECT` | `100` | Points for a correct guess |
| `HINT_COST_POINTS` | `30` | Points to reveal one swapped pair |
| `TURNS_PER_PLAYER` | `3` | Guesses per turn before switching |
| `SESSION_DURATION_SEC` | `45` | Seconds per round (30–60 recommended) |
| `MIN_PLAYERS` | `2` | Minimum players to start |
| `MAX_PLAYERS` | `4` | Maximum players per session |

Copy `.env.example` to `.env` to override:

```bash
cp .env.example .env
```

---

## 🤖 Pluggable LLM Endpoint

Signal Decay can generate words dynamically via any LLM API. Set `LLM_ENDPOINT` (and optionally `LLM_API_KEY`) to enable it.

**Request** — the server sends:

```json
POST ${LLM_ENDPOINT}
Authorization: Bearer ${LLM_API_KEY}

{
  "messages": [{ "role": "user", "content": "Generate a word between 6 and 8 chars..." }],
  "max_tokens": 150,
  "temperature": 0.8
}
```

**Response** — any of these formats work:

```js
// Direct
{ "word": "butterfly", "hint": "A caterpillar's glow-up" }

// OpenAI-compatible
{ "choices": [{ "message": { "content": "{\"word\": \"...\", \"hint\": \"...\"}" } }] }

// Anthropic-compatible
{ "content": [{ "text": "{\"word\": \"...\", \"hint\": \"...\"}" }] }
```

If the LLM fails or is unconfigured, the game seamlessly falls back to the **built-in word bank** (250+ words across all difficulty levels with hand-crafted witty hints).

---

## 🐳 Docker Deployment

```bash
# Default (server:8080, client:3000)
docker compose up --build

# Custom ports & config
WS_PORT=9090 CLIENT_PORT=8000 SESSION_DURATION_SEC=60 docker compose up --build

# With LLM
LLM_ENDPOINT=https://api.openai.com/v1/chat/completions LLM_API_KEY=sk-... docker compose up --build
```

The client Dockerfile builds a static Vite bundle served by nginx. The server Dockerfile compiles TypeScript and runs the production JS.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT (React)                    │
│                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ App.tsx  │  │useGameSocket │  │  styles.css  │  │
│  │ (screens)│◄─┤  (WS hook)   │  │ (terminal UI)│  │
│  └──────────┘  └──────┬───────┘  └──────────────┘  │
│                       │ WebSocket                    │
└───────────────────────┼─────────────────────────────┘
                        │
          ┌─────────────▼─────────────┐
          │     SERVER (Node.js)      │
          │                           │
          │  ┌─────────────────────┐  │
          │  │    index.ts         │  │
          │  │ (WS server, routing)│  │
          │  └─────────┬───────────┘  │
          │            │              │
          │  ┌─────────▼───────────┐  │
          │  │   session.ts        │  │
          │  │ (game state machine)│  │
          │  └──┬──────────────┬───┘  │
          │     │              │      │
          │  ┌──▼─────┐  ┌────▼───┐  │
          │  │board.ts│  │wordgen │  │
          │  │(shuffle)│  │(LLM+  │  │
          │  │        │  │ bank)  │  │
          │  └────────┘  └────────┘  │
          │                           │
          │  ┌────────┐  ┌────────┐  │
          │  │config  │  │ types  │  │
          │  │(.env)  │  │(shared)│  │
          │  └────────┘  └────────┘  │
          └───────────────────────────┘
```

### WebSocket Protocol

All messages are JSON. Full TypeScript definitions in `server/src/types.ts`.

| Direction | Message | Description |
|---|---|---|
| Client → Server | `join` | Join/create a session with a player name |
| Client → Server | `start_game` | Start the game from lobby |
| Client → Server | `guess` | Submit a word guess |
| Client → Server | `buy_hint` | Spend points to reveal a swapped pair |
| Server → Client | `session_update` | Full game state snapshot |
| Server → Client | `joined` | Confirms join with player ID |
| Server → Client | `guess_result` | Whether a guess was correct |
| Server → Client | `hint_revealed` | Which pair was uncovered |
| Server → Client | `round_won` | Round result with points |
| Server → Client | `turn_switched` | Whose turn it is now |
| Server → Client | `error` | Error messages |

### Game State Machine

```
lobby → countdown → playing ⇄ round_end → game_over
                        ↑          │
                        └──────────┘
                      (next round)
```

---

## 🗂️ Project Structure

```
signal-decay/
├── server/
│   ├── src/
│   │   ├── index.ts          # WebSocket server + session routing
│   │   ├── config.ts         # All game params (env-configurable)
│   │   ├── types.ts          # TypeScript types & WS protocol
│   │   ├── session.ts        # Game session state machine
│   │   ├── board.ts          # Letter shuffle & reveal logic
│   │   └── wordgen.ts        # LLM integration + 250-word fallback bank
│   ├── Dockerfile
│   ├── tsconfig.json
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.tsx            # All game screens (join/lobby/play/gameover)
│   │   ├── useGameSocket.ts   # WebSocket React hook with auto-reconnect
│   │   ├── types.ts           # Client-side type mirrors
│   │   ├── styles.css         # Dark terminal / NOC aesthetic
│   │   └── vite-env.d.ts
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── index.html
│   ├── tsconfig.json
│   └── package.json
├── docker-compose.yml
├── .env.example
├── .gitignore
├── LICENSE
├── CONTRIBUTING.md
└── README.md
```

---

## 📜 License

[AGPL v3](LICENSE)

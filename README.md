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

[Play Now](#-play-now) · [Quick Start](#-quick-start) · [How to Play](#-how-to-play) · [Game Modes](#-game-modes) · [Configuration](#-configuration) · [LLM Integration](#-pluggable-llm-endpoint) · [Docker](#-docker-deployment) · [Architecture](#-architecture)

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

1. **Pick a mode** — Classic, Teams, Co-op or Solo (see below)
2. **Join a session** — Enter a callsign and optionally a session code to join friends
3. **Read the board** — The word is displayed with its **middle letters shuffled**. First and last characters (and special chars like `-`) stay fixed
4. **Read the hint** — A witty, non-obvious clue is shown to guide your guess
5. **Take turns guessing** — Each player gets a set number of guesses per turn, then it switches
6. **Buy reveals** — Spend points to uncover a swapped pair (letters snap back to their correct positions)
7. **Score** — Correct guess = base points + time bonus + remaining-pairs bonus
8. **Difficulty ramps** — Word length increases from 4 to 20+ letters as rounds progress

> Swapped pairs never consist of identical letters — every shuffle is meaningful.

---

## 🕹️ Game Modes

The board, timer, word packs and difficulty ramp are identical in every mode.
What changes is **who holds the mic, where points are banked, and what happens
when a word goes unsolved**.

| Mode | Players | Turn structure | Point bank | Failing a word |
|---|---|---|---|---|
| **Classic** | 2–4 | Personal guess budget, then the turn passes | Your own score | Word revealed, next round |
| **Teams** | 2–4 (two squads) | Squad shares a pool; the mic moves after every miss | Squad score | Opponents get a steal window |
| **Co-op** | 2–4 | One shared pool for the table; mic moves after every miss | Shared bank | Costs a life |
| **Solo** | 1 (+ bot) | You and the bot alternate on the same word | Your own score | Word revealed, next round |

### 🛡 Teams

Two squads (**ALPHA** and **BRAVO**) alternate holding the word. Joining players
are auto-balanced into the smaller squad, and anyone can switch sides in the
lobby.

- The squad on the clock shares a pool of guesses. **Every miss hands the mic to
  the next teammate** — nobody monologues, and the whole squad stays in it.
- Empty the pool and the round enters a **STEAL**: the other squad gets one
  guess in a short window (`STEAL_SECONDS`, default 15s) worth a reduced share
  of the points (`STEAL_POINTS_PCT`, default 60%). This is the game-show
  pressure valve that keeps the idle squad watching the board.
- Ownership alternates every round, so a steal never costs a squad its turn.
- Reveals are paid from the **squad's** score, and only the squad on the clock
  may buy one. Personal scores are still tracked for the end-of-game MVP.

### 🤝 Co-op

No opponents — the table plays against the word list.

- **One shared guess pool per word** (`COOP_GUESSES_BASE` + player count). A
  wasted guess costs everyone, which is what makes people talk before answering.
- **One shared point bank.** Any player may buy a reveal at any time, not just
  whoever holds the mic.
- **Lives** (`COOP_LIVES`, default 3). Failing a word costs one; the run ends
  when they're gone.
- The run is **graded S/A/B/C/D** on solve rate and volume — co-op rewards a
  performance, not a winner. Individual scores are shown as contributions.

### 🤖 Solo

One human against a heuristic bot rival, alternating turns on the same word.
Solo rooms are private and cannot be joined.

The bot obviously knows the answer, so its skill is *simulated*: each guess rolls
against a solve probability shaped by word length and how many pairs are still
scrambled. A failed roll plays a **decoy** — the board with one more pair
transposed — so its turns read as real attempts. It buys reveals when the board
is messy and it can afford to.

| Difficulty | Behaviour |
|---|---|
| `easy` | Rarely solves early — good for learning the board |
| `normal` | A steady rival that punishes slow rounds |
| `hard` | Solves fast and buys reveals often |
| `adaptive` *(default)* | Rubber-bands to your score: sharpens up when you lead, eases off when you fall behind |

**Adaptive** is the recommended setting for practice — it keeps the match close
without ever being unbeatable.

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
| `STEAL_SECONDS` | `15` | Team mode: length of the steal window |
| `STEAL_POINTS_PCT` | `60` | Team mode: % of round points a steal is worth |
| `COOP_LIVES` | `3` | Co-op mode: lives per run |
| `COOP_GUESSES_BASE` | `3` | Co-op mode: shared pool = base + player count |
| `BOT_NAME` | `CIPHER` | Solo mode: rival's display name |
| `BOT_MIN_THINK_MS` | `1800` | Solo mode: fastest bot thinking pause |
| `BOT_MAX_THINK_MS` | `7000` | Solo mode: slowest bot thinking pause |

Copy `.env.example` to `.env` to override:

```bash
cp .env.example .env
```

### Host overrides (in the lobby)

The values above are the room's defaults. A host who wants a game of a
particular *length* can override some of them per session from the lobby's
**Game length & rules** panel — it starts switched off, and a lobby that never
touches it plays exactly the game the server was configured for.

| Control | Overrides | Range |
|---|---|---|
| Words in the game | the difficulty ramp's round count | 1–500 |
| Time per word | `SESSION_DURATION_SEC` | 10–300s |
| Turn / shared guesses | `TURNS_PER_PLAYER` (`COOP_GUESSES_BASE` in co-op) | 1–10 |
| Lives (co-op) | `COOP_LIVES` | 1–10 |

Picking a target length (5–15, 10–20, 20–30, 30–45 or 45–60 minutes) fills in
the word count that lands mid-band; the panel then shows a live estimate
(`≈ 24 min`, with a fast/slow range) and says whether the current selection
still fits the target. The estimate models a round as a fraction of its clock
rather than the whole thing — see `src/shared/estimate.ts`.

Hosts can also stack **several packs** into one pool. The packs are merged and
de-duplicated, so three 20-word packs play the same as one 60-word pack; if the
word goal exceeds the pool, the panel warns that words will repeat.

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
| Client → Server | `set_word_pack` | Host picks one word pack (lobby only) |
| Client → Server | `set_word_packs` | Host replaces the whole pack selection (lobby only) |
| Client → Server | `set_rules` | Host overrides length/time/guesses; `null` resets (lobby only) |
| Client → Server | `set_mode` | Host switches game mode (lobby only) |
| Client → Server | `set_team` | Player picks a squad (team mode, lobby only) |
| Client → Server | `set_bot_difficulty` | Host sets the solo rival's skill (lobby only) |
| Server → Client | `session_update` | Full game state snapshot |
| Server → Client | `joined` | Confirms join with player ID |
| Server → Client | `guess_result` | Whether a guess was correct |
| Server → Client | `hint_revealed` | Which pair was uncovered |
| Server → Client | `round_won` | Round result with points |
| Server → Client | `turn_switched` | Whose turn it is now |
| Server → Client | `steal_phase` | Team mode: attack failed, opponents get one shot |
| Server → Client | `life_lost` | Co-op mode: word unsolved, a life is gone |
| Server → Client | `error` | Error messages |

### Game State Machine

```
lobby → countdown → playing ⇄ round_end → game_over
                        ↑          │
                        └──────────┘
                      (next round)

Team mode adds a phase inside `playing`:

  attack ──(pool empty / time up)──► steal ──(miss)──► round_end
     │                                 │
     └──────(correct)──────────────────┴──(correct, reduced points)──► round_end
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

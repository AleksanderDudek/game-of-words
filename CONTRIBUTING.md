# Contributing to Signal Decay

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/YOUR_USERNAME/signal-decay.git
cd signal-decay

# Install everything
cd server && npm install && cd ..
cd client && npm install && cd ..

# Run in dev mode (two terminals)
cd server && npx ts-node src/index.ts
cd client && npx vite --host
```

## Project Structure

- `server/src/config.ts` — All game parameters (env-configurable)
- `server/src/types.ts` — Shared TypeScript types (WebSocket protocol)
- `server/src/board.ts` — Letter shuffle/reveal logic
- `server/src/wordgen.ts` — LLM integration + fallback word bank
- `server/src/session.ts` — Game session state machine
- `server/src/index.ts` — WebSocket server entry point
- `client/src/App.tsx` — React game UI
- `client/src/useGameSocket.ts` — WebSocket React hook
- `client/src/styles.css` — Dark terminal theme

## Adding Words to the Bank

Edit `server/src/wordgen.ts` → `WORD_BANK` object. Group by word length, and provide a witty, non-obvious hint.

## Adding LLM Providers

The `generateFromLLM()` function in `wordgen.ts` supports three response formats (direct, OpenAI, Anthropic). To add a new format, extend the response parsing block.

## Code Style

- TypeScript strict mode is enabled
- Run `npx tsc --noEmit` in both `server/` and `client/` to type-check
- Keep the WebSocket protocol types in sync between server and client `types.ts`

## Pull Requests

1. Fork the repo and create a feature branch
2. Make your changes
3. Ensure `tsc --noEmit` passes for both server and client
4. Submit a PR with a clear description

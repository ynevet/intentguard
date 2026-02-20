# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IntentGuard prevents the #1 DLP blindspot: attachments that don't match what users say they are. AI performs three-axis verification — **Intent** (what user claims) vs **Content** (what's actually inside) vs **Context** (channel/destination) — to catch mis-sends before they leak. E.g., user says "demo slides" but attaches Q1 financials, or "anonymized report" contains raw PII. Slack-first, privacy-safe, zero content retention. Early stage — no tests, no linting.

## Repository Layout

```
IntentGuard/
├── docker-compose.yml        # Postgres 17 (dev), pgdata volume
└── intentguard-backend/      # Node.js backend (see its own CLAUDE.md for detailed architecture)
    ├── server.js              # Entry point: mounts routers, health check, gates startup on DB init
    ├── routes/
    │   ├── slack.js           # Slack Events API: signature verification, event dispatch, mismatch response
    │   └── admin.js           # Admin dashboard — paginated evaluation history
    ├── lib/
    │   ├── risk-engine.js     # Core: analyzeMessage() — three-axis verification via OpenAI GPT-4o vision
    │   ├── db.js              # pg.Pool singleton + initDb() schema migration
    │   ├── evaluation-store.js # saveEvaluation() — fire-and-forget persistence
    │   ├── slack-client.js    # Shared @slack/web-api WebClient singleton
    │   └── logger.js          # Pino logger with daily file rotation
    ├── package.json           # CommonJS, Express 5, @slack/web-api, openai, pg
    └── ngrok.yml              # Tunnel config for local Slack webhook development
```

## Commands

All commands run from `intentguard-backend/`:

```bash
docker compose up -d   # Start Postgres 17 (from repo root)
npm install            # Install dependencies
npm run dev            # Development: node --watch (auto-restarts on file changes)
npm start              # Production: node server.js
```

No test runner or linter is configured.

## Architecture

`server.js` is a thin entry point that mounts route modules and starts the server (gated behind `initDb()`). Integration-specific logic lives in `routes/`. Each router owns its own body parsing middleware.

**Data flow:** Slack webhook → signature verification → immediate 200 ack → async processing → risk engine (OpenAI GPT-4o) → fire-and-forget DB persistence → emoji reaction + mismatch response (delete message, DM user).

**Key design decisions:**
- **Fail-open**: errors return `uncertain`, never blocking user messages
- **Fire-and-forget persistence**: evaluation writes never block the Slack response path
- **Zero content retention**: only metadata (match result, confidence, reasoning) persisted — file contents never stored
- **Graceful degradation**: missing API keys skip analysis, download failures fall back to metadata-only, deletion failures fall back to thread warnings

See `intentguard-backend/CLAUDE.md` for detailed module docs, request flow, and development notes.

## Environment Variables

Configured in `intentguard-backend/.env`:

| Variable | Purpose |
|---|---|
| `SLACK_SIGNING_SECRET` | HMAC-SHA256 signature verification (skipped if unset) |
| `SLACK_BOT_TOKEN` | Used by `@slack/web-api` for API calls and file downloads |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o vision analysis (risk engine skips if unset) |
| `DATABASE_URL` | PostgreSQL connection string (required — server won't start without it) |
| `PORT` | Server port (default: 3000) |

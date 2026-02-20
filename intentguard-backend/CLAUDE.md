# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IntentGuard prevents the #1 DLP blindspot: attachments that don't match what users say they are. This backend performs three-axis verification — **Intent** (what user claims) vs **Content** (what's actually inside) vs **Context** (channel/destination) — to catch mis-sends before they leak. Slack-first, Node.js/Express 5, OpenAI GPT-4o vision, CommonJS. No tests or linting configured. Early stage.

## Commands

```bash
npm start        # node server.js
npm run dev      # node --watch (auto-restarts on server.js, .env, routes/, or lib/ changes)
npm install      # install dependencies
```

No test runner or linter is configured. Start Postgres first: `docker compose up -d` from the repo root (Postgres 17, credentials: `intentguard`/`intentguard`/`intentguard`).

## Architecture

`server.js` is a thin entry point: loads env vars, mounts route modules, serves a health check (`GET /`), and starts the server. Gates `app.listen()` behind `initDb()` — server won't start if DB is unreachable.

**Adding a new integration:** create `routes/<provider>.js` exporting an Express Router, mount it in `server.js` with `app.use('/<provider>', router)`.

### Request Flow (Slack webhook → response)

1. `POST /slack/events` receives raw body via `express.raw()` — required because Slack signature verification needs the raw request body string, not parsed JSON
2. HMAC-SHA256 verification with `crypto.timingSafeEqual()` + 5-minute timestamp window (replay attack protection)
3. `url_verification` handled synchronously (Slack handshake)
4. All other events: **ack immediately with `200`** (Slack has a 3-second timeout), then process async
5. Route-level guards skip thread replies (`thread_ts !== ts`) and bot messages (`bot_id`/`bot_profile`)
6. `analyzeMessage(event)` runs risk analysis → `saveEvaluation()` fires-and-forgets to DB → `reactToAssessment()` posts reactions/warnings

### Mismatch Response Sequence

On mismatch, three actions in order:
1. Add `:warning:` emoji reaction
2. **Delete the original message** from the channel; if deletion fails (permissions), fall back to posting a threaded warning
3. **DM the user** with full reasoning and file details

Match → `:white_check_mark:` emoji. Uncertain → `:grey_question:` emoji. Skipped → no reaction.

### Risk Engine (`lib/risk-engine.js`)

- `analyzeMessage(event)` — guards: skips if subtype in `SKIP_SUBTYPES`, no text, no files, or `OPENAI_API_KEY` unset
- Files categorized as images (sent to GPT-4o vision as base64) or non-images (metadata-only: filename, mimetype, size)
- `Promise.allSettled()` for parallel image downloads — one failure doesn't block others, falls back to metadata-only
- OpenAI GPT-4o: temperature 0.2, `response_format: { type: 'json_object' }`, 1024 max tokens
- Returns: `{ match, confidence, reasoning, filesAnalyzed, error }` where match is `match`|`mismatch`|`uncertain`|`skipped`
- **Fail-open design**: any error returns `uncertain`, never disrupts the user

### Other Modules

- **`lib/db.js`** — `pg.Pool` singleton (max 10 connections) + `initDb()` creates `evaluations` table + indexes idempotently
- **`lib/evaluation-store.js`** — `saveEvaluation(event, assessment)` — parameterized INSERT, fire-and-forget (never blocks Slack flow)
- **`lib/slack-client.js`** — Shared `@slack/web-api` WebClient singleton
- **`lib/logger.js`** — Pino logger with dual transport: daily file rotation (`logs/`, 14-day retention, 20MB max) + pretty console
- **`routes/admin.js`** — `GET /admin/evaluations?page=N` — paginated HTML dashboard (excludes skipped, 25 per page, dark theme)

## Key Patterns

- **Each router owns its own body parsing middleware** — Slack needs `express.raw()`, other routes may need different parsers
- **Fire-and-forget persistence** — `saveEvaluation()` called without `await`; errors logged but never block Slack response
- **Singletons via module caching** — `db.js`, `slack-client.js`, `logger.js` export singleton instances; `risk-engine.js` lazily creates OpenAI client
- **Graceful degradation everywhere** — missing API keys skip analysis, file download failures fall back to metadata, message deletion failures fall back to thread warnings, DB errors log and continue

## Environment Variables (`.env`)

| Variable | Purpose |
|---|---|
| `SLACK_SIGNING_SECRET` | HMAC-SHA256 signature verification (skipped if unset) |
| `SLACK_BOT_TOKEN` | Used by `@slack/web-api` for API calls and file downloads |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o vision analysis (risk engine skips if unset) |
| `DATABASE_URL` | PostgreSQL connection string (required — server won't start without it) |
| `PORT` | Server port (default: 3000) |

## Development Notes

- Local development uses ngrok (configured in `ngrok.yml`) to tunnel webhooks from Slack
- Slack signature verification is done manually with Node.js `crypto` — no dependency on the deprecated `@slack/events-api`
- `@slack/web-api` v7 is used; requires Node.js >= 18
- Express 5 (not 4) — be aware of breaking changes (e.g., `req.query` is a getter, path-to-regexp v8)
- Zero content retention: only metadata (match result, confidence, reasoning) is persisted — file contents are never stored

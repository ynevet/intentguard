# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IntentGuard is an AI-powered DLP tool that catches the #1 blindspot: attachments that don't match what users say they are. It performs three-axis verification — **Intent** (what user claims) vs **Content** (what's actually inside) vs **Context** (channel/destination) — to catch mis-sends before they leak. Slack-first, privacy-safe, zero content retention. Early stage — no tests, no linting.

## Commands

All commands run from `intentguard-backend/`:

```bash
docker compose up -d   # Start Postgres 17 from repo root (creds: intentguard/intentguard/intentguard)
npm install            # Install dependencies
npm run dev            # Development: node --watch (auto-restarts on changes)
npm start              # Production: node server.js
npm test               # Run all tests (Node.js built-in test runner)
npm run test:watch     # Run tests in watch mode
```

No linter is configured.

## Architecture

### Detection Pipeline

Two-stage detection with pre-scan short-circuiting:

1. **Pre-scan** (`lib/pre-scan.js`) — Regex/heuristic detection: credit cards (Luhn-validated), SSNs, API keys, private keys, passwords, risky filenames, high-entropy tokens, bulk PII. Zero API cost. Critical findings short-circuit the LLM; lower-severity signals pass as hints.
2. **Text extraction** (`lib/extractors/`) — Lazy-loaded per-mimetype extractors with 3s timeout: PDF (`pdf-parse`), DOCX (`mammoth`), XLSX (`xlsx`), PPTX (`officeparser`), CSV (`csv-parse`), plaintext/JSON/YAML/XML. Truncated to 3000 chars.
3. **AI analysis** (`lib/risk-engine.js`) — OpenAI GPT-4o-mini: images via vision (base64, max 5, detail:low), documents via extracted text, others via metadata-only. JSON response format, temperature 0.2, 512 max tokens. Single retry on 429/5xx.
4. **Response** (`routes/slack.js`) — Mismatch: delete files (via user token), DM sender with reasoning + re-send prompt. Match: checkmark emoji. Uncertain: question mark emoji. Skipped: no reaction.

### Request Flow (Slack webhook)

`POST /slack/events` → `express.raw()` → HMAC-SHA256 verification → immediate `200` ack → async `processEvent()` → guards (thread replies, bots, disabled analysis, channel filtering) → `analyzeMessage()` → `saveEvaluation()` → `reactToAssessment()`

### Re-send Flow

On mismatch DM, a `resend_contexts` row is stored (DB-backed, 24h TTL). If the user replies in that DM thread with files, the bot downloads and re-uploads them to the original channel.

### Scheduled Jobs (server.js)

- Retention cleanup — every 6h, per-workspace (deletes evaluations older than configurable retention days)
- Monthly rollup — every 6h, per-workspace (aggregates stats into `monthly_summaries`)
- Auto-join channels — every 5m, per-workspace (joins all public channels)
- Resend context cleanup — every 30m, global (deletes expired re-send contexts)
- Supabase keep-alive — every 6h (prevents free-tier project pause)

### Admin Dashboard

Server-rendered HTML pages (dark theme, no frontend framework):
- `/admin/login` — Cookie-based auth (HMAC of `ADMIN_SECRET`; skipped if unset)
- `/admin/evaluations` — Paginated evaluation history + global settings (analysis toggle, retention days)
- `/admin/stats` — Analytics: verdicts, detection breakdown, mismatch types, risk channels/users, cost savings
- `/admin/integrations` — Integration hub (Slack active; Teams/Email coming soon)
- `/admin/integrations/slack` — Channel monitoring, alert thresholds, strict audience blocking, excluded channels
- `/features` — Product features marketing page
- `/slack/oauth/install` — Public "Add to Slack" landing page
- `/slack/oauth/authorize` — Initiates OAuth V2 flow with CSRF state
- `/slack/oauth/callback` — Exchanges code for tokens, stores workspace in DB

### Key Design Decisions

- **Fail-open**: errors return `uncertain`, never blocking user messages
- **Fire-and-forget persistence**: DB writes never block Slack response; `saveEvaluation()` is now awaited for evaluationId but failures are caught and logged
- **Zero content retention**: message text is SHA-256 hashed before storage; file contents, AI reasoning, and findings are never persisted; Pino redacts sensitive log paths
- **Graceful degradation**: missing API keys skip analysis, download failures fall back to metadata-only, deletion failures fall back to DM-only
- **Each router owns its own body parsing** — Slack needs `express.raw()`, admin routes use `express.urlencoded()`
- **Per-workspace Slack clients** — `slack-client.js` is a factory (`getSlackClient(workspaceId)`) with `Map` caching; falls back to env vars for `'default'` workspace
- **Multi-workspace via OAuth** — Slack OAuth V2 flow stores per-workspace tokens in the `workspaces` table; `processEvent()` resolves workspace from `payload.team_id`; env-var single-workspace setups continue working unchanged

### Database Schema (Postgres 17)

Migrations run idempotently in `initDb()`:
- `evaluations` — Core scan results (privacy-safe: no message_text, no reasoning)
- `file_analyses` — Per-file records (normalized from JSONB), linked to evaluations
- `detection_events` — Immutable event log for pipeline actions (pre_scan_hit, llm_analysis, file_deleted, dm_sent, user_resent)
- `monthly_summaries` — Pre-aggregated rollups for fast dashboard queries
- `settings` — Key-value config, composite PK `(workspace_id, key)`, `slack.*` namespaced keys
- `workspaces` — Registry for multi-tenancy with OAuth token storage (`bot_token`, `user_token`, `bot_user_id`, `team_name`, `installed_at`)
- `resend_contexts` — DM re-send state (replaces in-memory Map)

## Environment Variables

Configured in `intentguard-backend/.env`:

| Variable | Purpose |
|---|---|
| `SLACK_SIGNING_SECRET` | HMAC-SHA256 signature verification (skipped if unset) |
| `SLACK_BOT_TOKEN` | Bot token for Slack API calls and file downloads (fallback for `default` workspace; OAuth installs store tokens in DB) |
| `SLACK_USER_TOKEN` | User token for deleting user-uploaded files (optional, requires files:write; fallback for `default` workspace) |
| `SLACK_CLIENT_ID` | Slack app Client ID — enables OAuth multi-workspace install flow |
| `SLACK_CLIENT_SECRET` | Slack app Client Secret — required with `SLACK_CLIENT_ID` |
| `SLACK_OAUTH_REDIRECT_URI` | OAuth callback URL, e.g. `https://your-domain.com/slack/oauth/callback` |
| `OPENAI_API_KEY` | OpenAI GPT-4o-mini analysis (risk engine skips if unset) |
| `DATABASE_URL` | PostgreSQL connection string — local dev |
| `POSTGRES_URL` | PostgreSQL connection string — production (Supabase, SSL enabled) |
| `NODE_ENV` | `production` uses `POSTGRES_URL` + SSL; otherwise uses `DATABASE_URL` |
| `ADMIN_SECRET` | Admin dashboard password (auth skipped if unset — local dev convenience) |
| `PORT` | Server port (default: 3000) |

## Tech Stack

- **Runtime:** Node.js >= 18, Express 5, CommonJS
- **AI:** OpenAI GPT-4o-mini (vision + text), `response_format: json_object`
- **Slack:** @slack/web-api v7 (bot + optional user client)
- **Database:** PostgreSQL 17 via `pg`
- **File parsing:** pdf-parse, mammoth (DOCX), xlsx, officeparser (PPTX), csv-parse
- **Logging:** Pino with daily file rotation (pino-roll) + pretty console (pino-pretty)
- **Auth:** cookie-parser + HMAC session cookies

See `intentguard-backend/CLAUDE.md` for module-level detail.

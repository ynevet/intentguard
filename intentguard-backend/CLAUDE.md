# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IntentGuard backend — Node.js/Express 5, CommonJS. Three-axis DLP verification (Intent vs Content vs Context) for Slack file attachments. OpenAI GPT-4o-mini for AI analysis, PostgreSQL 17 for persistence. No linting configured.

## Commands

```bash
npm start        # node server.js
npm run dev      # node --watch --watch-preserve-output server.js
npm install      # install dependencies
npm test         # run all tests (Node.js built-in test runner, no DB required)
npm run test:watch  # run tests in watch mode
```

Start Postgres first: `docker compose up -d` from the repo root.

## Module Reference

### Entry Point

- **`server.js`** — Mounts routers, serves health check, gates startup behind `initDb()`. Runs scheduled jobs per-workspace via `forEachWorkspace()`: retention cleanup (6h), monthly rollup (6h), auto-join channels (5m). Global jobs: resend context cleanup (30m), Supabase keep-alive (6h). Public routes: `/slack`, `/slack/oauth`, `/admin/login`. Protected routes (behind `requireAuth`): `/admin/*`, `/features`, `/`.

### Routes

- **`routes/slack.js`** — `POST /slack/events`: raw body parsing, HMAC-SHA256 verification, immediate 200 ack, async processing. Resolves workspace from `payload.team_id` via DB lookup (falls back to `'default'` if env vars set). Guards: thread replies, bots, disabled analysis, channel monitoring/exclusion. Handles DM re-send replies. Contains `reactToAssessment()` (mismatch → delete files + DM; match → checkmark; uncertain → question mark). All Slack API calls use per-workspace clients.
- **`routes/slack-oauth.js`** — Slack OAuth V2 flow. `GET /authorize`: CSRF state + redirect to Slack. `GET /callback`: exchanges code for tokens via `oauth.v2.access`, stores workspace in DB, seeds default settings, invalidates client cache. `GET /install`: public "Add to Slack" landing page. State stored in-memory Map with 10-min TTL.
- **`routes/admin.js`** — `GET /admin/evaluations`: paginated HTML table (25/page, excludes skipped). `GET/POST /admin/settings`: global analysis toggle + retention days.
- **`routes/admin-login.js`** — `GET/POST /admin/login`, `GET /admin/login/logout`. Cookie-based session auth.
- **`routes/admin-stats.js`** — `GET /admin/stats`: analytics dashboard with live current-month queries + last-month comparison.
- **`routes/admin-integrations.js`** — `GET /admin/integrations`: integration hub page. Shows DB-backed connected workspace count. "+ Add Workspace" card when `SLACK_CLIENT_ID` is set.
- **`routes/admin-integrations-slack.js`** — `GET/POST /admin/integrations/slack`: channel monitoring, alert thresholds, strict audience blocking, excluded channels. Shows connected workspaces list from DB. Handles `?installed=1` success toast and `?error=` OAuth error toast.
- **`routes/features.js`** — `GET /features`: static product features marketing page.

### Core Libraries

- **`lib/risk-engine.js`** — `analyzeMessage(event, workspaceId)`: orchestrates pre-scan → text extraction → OpenAI call. Guards: SKIP_SUBTYPES, no text, URL-only messages, no files, no API key. Fetches channel context (name, type, privacy, members, external). Builds multipart OpenAI messages with vision images (base64, max 5), extracted text, and metadata-only fallbacks. GPT-4o-mini, temperature 0.2, 512 max tokens, JSON response format. Single retry on 429/5xx. Returns `{ match, confidence, reasoning, contextRisk, mismatchType, intentLabel, riskSummary, filesAnalyzed, error, analysisMethod, preScanFindings }`.

- **`lib/pre-scan.js`** — `preScan(messageText, extractedFiles, allFiles)`: regex/heuristic detection before LLM. Detects: credit cards (Luhn-validated), SSNs, UK NINOs, API keys (OpenAI/AWS/GitHub/Slack/GitLab/npm/Stripe/SendGrid/Heroku), private keys (PEM), passwords, .env content, bulk emails (10+), bulk phones (10+), high-entropy tokens (Shannon entropy >= 4.5), risky filenames. Severity: critical/high/medium. Verdicts: `mismatch` (critical findings → skip LLM), `signals_only` (pass hints to LLM), `clean`.

- **`lib/extractors/index.js`** — Registry mapping mimetypes to lazy-loaded extractors. 3s timeout per file, 20MB size limit, 3000 char truncation. `canExtract(file)` and `extractText(buffer, mimetype)`.
  - `pdf.js` — pdf-parse
  - `docx.js` — mammoth (extracts raw text)
  - `xlsx.js` — xlsx (first 50 rows, all sheets)
  - `pptx.js` — officeparser
  - `csv.js` — csv-parse (first 50 rows)
  - `plaintext.js` — direct Buffer.toString (text/plain, markdown, JSON, XML, YAML, HTML)

- **`lib/db.js`** — `pg.Pool` singleton (max 10). `initDb()` creates/migrates all tables idempotently (evaluations, settings, workspaces, file_analyses, detection_events, monthly_summaries, resend_contexts). Workspaces table includes OAuth columns: `bot_token`, `user_token`, `bot_user_id`, `team_name`, `installed_at`. Seeds default settings. Handles legacy privacy migration (drops message_text/reasoning columns, backfills structured fields). Exports: `pool`, `initDb`, `getSetting`, `setSetting`, `runRetentionCleanup`, `saveResendContext`, `getResendContext`, `deleteResendContext`, `cleanupExpiredResendContexts`, `getWorkspace`, `upsertWorkspace`, `getAllActiveWorkspaces`, `seedWorkspaceSettings`. Production uses `POSTGRES_URL` with SSL; dev uses `DATABASE_URL`.

- **`lib/evaluation-store.js`** — `saveEvaluation(event, assessment, platform, workspaceId)`: hashes message text synchronously (safe for fire-and-forget), strips sensitive fields from files, inserts evaluation + per-file `file_analyses` rows + `detection_events`. Returns `evaluationId`. `recordEvent(evaluationId, workspaceId, eventType, eventData)`: immutable event log.

- **`lib/rollup.js`** — `rollupMonthlySummary(workspaceId)`: aggregates current month data into `monthly_summaries` via upsert. Tracks: scans, files, verdicts, detection methods, estimated cost savings, top mismatch types/channels/users.

- **`lib/auth.js`** — `requireAuth` middleware: validates `ig_session` cookie (HMAC of ADMIN_SECRET). Skips auth entirely if `ADMIN_SECRET` unset (local dev). `validateLogin(secret)` for login form.

- **`lib/slack-client.js`** — Per-workspace Slack client factory with `Map` caching. `getSlackClient(workspaceId)`: returns `WebClient` for bot token (DB first, env var fallback for `'default'`). `getSlackUserClient(workspaceId)`: same for user token, returns `null` if none. `getBotToken(workspaceId)`: raw token string for `fetch()` calls. `invalidateClientCache(workspaceId)`: clears cache after OAuth re-auth. Lazy `require('./db')` avoids circular dependency.

- **`lib/logger.js`** — Pino logger with dual transport: daily file rotation (logs/, 14-day, 20MB) + pretty console. Redacts: event.text, reasoning, file URLs, file findings.

- **`lib/nav.js`** — `buildNav(activePage)`: shared HTML nav bar for all admin pages.

## Key Patterns

- **Each router owns its own body parsing** — Slack needs `express.raw()`, admin forms use `express.urlencoded()`
- **Singletons via module caching** — db, logger export instances; risk-engine lazily creates OpenAI client; slack-client uses per-workspace factory with Map caching
- **Graceful degradation everywhere** — missing keys skip analysis, download failures fall back to metadata, deletion failures fall back to DM-only, DB errors log and continue
- **In-memory cleanup** — After processing, `event.text` and file URLs are nulled to prevent accidental retention
- **Settings are `slack.*` namespaced** — Platform-specific settings use prefixed keys (e.g., `slack.monitored_channels`) for future multi-platform support

# IntentGuard

AI-powered Data Loss Prevention that catches the #1 DLP blindspot: **attachments that don't match what users say they are.**

User says "demo slides" but attaches Q1 financials? Says "anonymized report" but it contains raw PII? IntentGuard catches it before it leaks.

## How It Works

IntentGuard performs **three-axis verification** on every file shared in Slack:

| Axis | What it checks |
|------|---------------|
| **Intent** | What the user claims the file is (message text) |
| **Content** | What's actually inside the file (text extraction + AI vision) |
| **Context** | Whether this is appropriate for the channel/audience |

### Detection Pipeline

1. **Pre-scan** — Regex/heuristic detection catches obvious PII, credentials, and secrets with zero API cost (credit cards, SSNs, API keys, private keys, high-entropy tokens)
2. **Text extraction** — PDFs, DOCX, XLSX, PPTX, and CSV files are parsed to extract actual content
3. **AI analysis** — OpenAI GPT-4o-mini evaluates intent vs content vs context for nuanced mismatches
4. **Response** — Mismatched files are silently deleted, and the sender gets a private DM with reasoning and a one-click re-send option

### On Mismatch

```
1. ⚠️  File silently deleted from the channel
2. 📩  Sender gets a private DM explaining why
3. ↩️  Sender can reply with the correct file to re-send
```

### On Match

```
✅  Green checkmark emoji — file is appropriate
```

## Key Design Principles

- **Fail-open** — Errors return "uncertain", never blocking user messages
- **Zero content retention** — Only metadata persisted; file contents are never stored
- **Graceful degradation** — Missing API keys skip analysis, download failures fall back to metadata-only
- **Privacy-safe** — Message text is hashed before storage, no raw content in the database

## Tech Stack

- **Runtime:** Node.js, Express 5, CommonJS
- **AI:** OpenAI GPT-4o-mini (vision + text)
- **Slack:** @slack/web-api v7, Events API with HMAC-SHA256 verification
- **Database:** PostgreSQL 17
- **File Parsing:** pdf-parse, mammoth (DOCX), xlsx, officeparser (PPTX)
- **Logging:** Pino with daily file rotation

## Getting Started

### Prerequisites

- Node.js >= 18
- Docker (for PostgreSQL)
- A Slack app with Bot Token and Signing Secret
- An OpenAI API key

### Setup

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Install dependencies
cd intentguard-backend
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 4. Start the server
npm run dev
```

### Environment Variables

Create `intentguard-backend/.env`:

```env
SLACK_SIGNING_SECRET=your_slack_signing_secret
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_USER_TOKEN=xoxp-your-user-token    # Optional: enables file deletion
OPENAI_API_KEY=sk-your-openai-key
DATABASE_URL=postgresql://intentguard:intentguard@localhost:5432/intentguard
PORT=3000
```

### Slack App Configuration

Your Slack app needs these scopes and settings:

**Bot Token Scopes:**
- `chat:write` — Send DMs and post messages
- `reactions:write` — Add emoji reactions
- `files:read` — Download shared files for analysis
- `channels:read` — Read channel metadata for context analysis
- `im:write` — Open DM conversations
- `users:read` — Resolve user information

**User Token Scopes (optional, for file deletion):**
- `files:write` — Delete mismatched files from channels

**Event Subscriptions:**
- `message.channels` — Messages in public channels
- `message.im` — DM messages (for re-send flow)

## Project Structure

```
IntentGuard/
├── docker-compose.yml              # Postgres 17 (dev)
└── intentguard-backend/
    ├── server.js                    # Entry point, route mounting, scheduled jobs
    ├── routes/
    │   ├── slack.js                 # Slack Events API, mismatch response flow
    │   ├── admin.js                 # Evaluation history dashboard
    │   ├── admin-stats.js           # Analytics dashboard
    │   ├── admin-integrations.js    # Integration hub
    │   └── admin-integrations-slack.js  # Slack-specific settings
    ├── lib/
    │   ├── risk-engine.js           # Core: three-axis verification via OpenAI
    │   ├── pre-scan.js              # Regex/heuristic pre-scan (zero-cost detection)
    │   ├── db.js                    # PostgreSQL pool, schema migrations, settings
    │   ├── evaluation-store.js      # Evaluation + file analysis persistence
    │   ├── rollup.js                # Monthly analytics aggregation
    │   ├── slack-client.js          # Slack WebClient singletons
    │   ├── logger.js                # Pino logger with file rotation
    │   ├── nav.js                   # Shared admin navigation
    │   └── extractors/              # File text extraction
    │       ├── index.js             # Registry with lazy loading + timeout
    │       ├── pdf.js               # PDF text extraction
    │       ├── docx.js              # Word document extraction
    │       ├── xlsx.js              # Excel spreadsheet extraction
    │       ├── pptx.js              # PowerPoint extraction
    │       ├── csv.js               # CSV extraction
    │       └── plaintext.js         # Plain text / JSON / YAML / XML
    └── public/
        └── logo.png
```

## Admin Dashboard

The built-in admin panel provides:

- **Evaluations** (`/admin/evaluations`) — Paginated history of all file verifications
- **Stats** (`/admin/stats`) — Detection breakdown, cost savings, risk trends
- **Integrations** (`/admin/integrations/slack`) — Configure monitored channels, thresholds, excluded channels

## License

ISC

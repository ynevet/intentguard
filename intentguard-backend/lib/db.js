const { Pool } = require('pg');
const logger = require('./logger');

const isProduction = process.env.NODE_ENV === 'production';
const rawConnectionString = isProduction
  ? process.env.POSTGRES_URL
  : process.env.DATABASE_URL;

// Strip sslmode/supa params from Supabase URLs — pg driver handles SSL via pool config
const connectionString = isProduction
  ? rawConnectionString.replace(/[?&](sslmode|supa)=[^&]*/g, '').replace(/\?$/, '')
  : rawConnectionString;

const pool = new Pool({
  connectionString,
  max: 10,
  ...(isProduction ? { ssl: { rejectUnauthorized: false } } : {}),
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error');
});

async function initDb() {
  const client = await pool.connect();
  try {
    // ── Core tables ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS evaluations (
        id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        platform        TEXT        NOT NULL DEFAULT 'slack',
        slack_user      TEXT        NOT NULL,
        slack_channel   TEXT        NOT NULL,
        slack_ts        TEXT        NOT NULL,
        slack_thread_ts TEXT,
        client_msg_id   TEXT,
        match           TEXT        NOT NULL,
        confidence      REAL        NOT NULL,
        files_analyzed  JSONB       NOT NULL DEFAULT '[]',
        error           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'slack';
      ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS context_risk TEXT NOT NULL DEFAULT 'none';

      -- Privacy-safe structured fields (replaces message_text + reasoning)
      ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS message_hash TEXT;
      ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS intent_label TEXT;
      ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS intent_confidence REAL;
      ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS mismatch_type TEXT;
      ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS risk_summary TEXT;

      -- Multi-tenancy: workspace_id on evaluations
      ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT 'default';

      CREATE INDEX IF NOT EXISTS idx_evaluations_channel_ts ON evaluations (slack_channel, slack_ts);
      CREATE INDEX IF NOT EXISTS idx_evaluations_user ON evaluations (slack_user);
      CREATE INDEX IF NOT EXISTS idx_evaluations_match ON evaluations (match);
      CREATE INDEX IF NOT EXISTS idx_evaluations_created_at ON evaluations (created_at);
      CREATE INDEX IF NOT EXISTS idx_evaluations_workspace ON evaluations (workspace_id);
      CREATE INDEX IF NOT EXISTS idx_evaluations_workspace_created ON evaluations (workspace_id, created_at);

      -- Workspaces registry (for multi-tenancy)
      CREATE TABLE IF NOT EXISTS workspaces (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL DEFAULT 'Default Workspace',
        platform    TEXT NOT NULL DEFAULT 'slack',
        status      TEXT NOT NULL DEFAULT 'active',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      INSERT INTO workspaces (id, name, platform, status)
        VALUES ('default', 'Default Workspace', 'slack', 'active')
        ON CONFLICT (id) DO NOTHING;

      -- Settings table (initial create for fresh installs — uses composite PK)
      CREATE TABLE IF NOT EXISTS settings (
        workspace_id TEXT NOT NULL DEFAULT 'default',
        key          TEXT NOT NULL,
        value        TEXT NOT NULL,
        PRIMARY KEY (workspace_id, key)
      );
    `);

    // ── Settings table migration: add workspace_id if missing ──
    const settingsColCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'settings' AND column_name = 'workspace_id'
    `);

    if (settingsColCheck.rows.length === 0) {
      logger.info('Settings migration: adding workspace_id column and composite PK');
      await client.query(`ALTER TABLE settings ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default'`);
      await client.query(`ALTER TABLE settings DROP CONSTRAINT settings_pkey`);
      await client.query(`ALTER TABLE settings ADD PRIMARY KEY (workspace_id, key)`);
      logger.info('Settings migration: workspace_id added, PK updated to (workspace_id, key)');
    }

    // ── Seed default settings (namespaced for Slack, global for platform-agnostic) ──
    await client.query(`
      INSERT INTO settings (workspace_id, key, value) VALUES ('default', 'analysis_enabled', 'true')
        ON CONFLICT (workspace_id, key) DO NOTHING;
      INSERT INTO settings (workspace_id, key, value) VALUES ('default', 'retention_days', '90')
        ON CONFLICT (workspace_id, key) DO NOTHING;
      INSERT INTO settings (workspace_id, key, value) VALUES ('default', 'slack.monitored_channels', '')
        ON CONFLICT (workspace_id, key) DO NOTHING;
      INSERT INTO settings (workspace_id, key, value) VALUES ('default', 'slack.warning_threshold', '50')
        ON CONFLICT (workspace_id, key) DO NOTHING;
      INSERT INTO settings (workspace_id, key, value) VALUES ('default', 'slack.delete_threshold', '70')
        ON CONFLICT (workspace_id, key) DO NOTHING;
      INSERT INTO settings (workspace_id, key, value) VALUES ('default', 'slack.strict_audience_blocking', 'false')
        ON CONFLICT (workspace_id, key) DO NOTHING;
    `);

    // ── Settings key rename migration: un-namespaced → slack.* prefixed ──
    const oldKeyCheck = await client.query(
      "SELECT key FROM settings WHERE key = 'monitored_channels' AND workspace_id = 'default'",
    );
    if (oldKeyCheck.rows.length > 0) {
      logger.info('Settings migration: renaming Slack-specific keys to slack.* namespace');
      const keyRenames = [
        ['monitored_channels', 'slack.monitored_channels'],
        ['warning_threshold', 'slack.warning_threshold'],
        ['delete_threshold', 'slack.delete_threshold'],
      ];
      for (const [oldKey, newKey] of keyRenames) {
        await client.query(
          `UPDATE settings SET key = $1
           WHERE key = $2 AND workspace_id = 'default'
           AND NOT EXISTS (SELECT 1 FROM settings WHERE key = $1 AND workspace_id = 'default')`,
          [newKey, oldKey],
        );
      }
      // Clean up any leftover old keys that couldn't be renamed (if new key already existed)
      await client.query(
        "DELETE FROM settings WHERE key IN ('monitored_channels', 'warning_threshold', 'delete_threshold')",
      );
      logger.info('Settings migration: Slack keys namespaced');
    }

    // ── Privacy migration: backfill then drop sensitive columns ──
    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'evaluations' AND column_name = 'message_text'
    `);

    if (colCheck.rows.length > 0) {
      logger.info('Privacy migration: backfilling structured fields from legacy columns');

      await client.query(`
        UPDATE evaluations
        SET message_hash = encode(sha256(message_text::bytea), 'hex')
        WHERE message_text IS NOT NULL AND message_hash IS NULL
      `);

      await client.query(`
        UPDATE evaluations
        SET mismatch_type = CASE
          WHEN match = 'mismatch' THEN 'unknown_legacy'
          ELSE 'none'
        END
        WHERE mismatch_type IS NULL
      `);

      await client.query(`
        UPDATE evaluations
        SET risk_summary = CASE
          WHEN match = 'mismatch' THEN 'Legacy mismatch (pre-privacy-hardening)'
          WHEN match = 'match' THEN 'Content matched stated intent'
          WHEN match = 'uncertain' THEN 'Could not determine match status'
          ELSE 'Skipped'
        END
        WHERE risk_summary IS NULL
      `);

      await client.query(`
        UPDATE evaluations
        SET files_analyzed = (
          SELECT COALESCE(jsonb_agg(
            elem - 'finding' || jsonb_build_object('classificationLabel', 'unknown_legacy')
          ), '[]'::jsonb)
          FROM jsonb_array_elements(files_analyzed) AS elem
        )
        WHERE jsonb_array_length(files_analyzed) > 0
      `);

      await client.query('ALTER TABLE evaluations DROP COLUMN IF EXISTS message_text');
      await client.query('ALTER TABLE evaluations DROP COLUMN IF EXISTS reasoning');

      logger.info('Privacy migration: sensitive columns dropped, structured fields backfilled');
    }

    // ── Analytics tables ──────────────────────────────────────────
    await client.query(`
      -- Per-file analysis records (normalized from evaluations.files_analyzed JSONB)
      CREATE TABLE IF NOT EXISTS file_analyses (
        id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        evaluation_id     BIGINT REFERENCES evaluations(id) ON DELETE CASCADE,
        workspace_id      TEXT NOT NULL DEFAULT 'default',
        file_name         TEXT NOT NULL,
        file_mimetype     TEXT,
        file_size         BIGINT,
        file_hash         TEXT,
        analysis_method   TEXT NOT NULL,
        classification_label TEXT,
        pre_scan_signals  JSONB,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- Immutable event log for every action in the detection pipeline
      CREATE TABLE IF NOT EXISTS detection_events (
        id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        evaluation_id     BIGINT REFERENCES evaluations(id) ON DELETE CASCADE,
        workspace_id      TEXT NOT NULL DEFAULT 'default',
        event_type        TEXT NOT NULL,
        event_data        JSONB,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- Pre-aggregated monthly rollups for fast dashboard queries
      CREATE TABLE IF NOT EXISTS monthly_summaries (
        id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        workspace_id         TEXT NOT NULL DEFAULT 'default',
        month                DATE NOT NULL,
        total_scans          INT DEFAULT 0,
        total_files          INT DEFAULT 0,
        matches              INT DEFAULT 0,
        mismatches           INT DEFAULT 0,
        uncertain            INT DEFAULT 0,
        pre_scan_catches     INT DEFAULT 0,
        llm_calls            INT DEFAULT 0,
        estimated_cost_saved NUMERIC(10,4) DEFAULT 0,
        top_mismatch_types   JSONB,
        top_risk_channels    JSONB,
        top_risk_users       JSONB,
        UNIQUE(workspace_id, month)
      );

      -- DM re-send context (moved from in-memory Map to prevent memory leaks)
      CREATE TABLE IF NOT EXISTS resend_contexts (
        id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        dm_channel        TEXT NOT NULL,
        dm_ts             TEXT NOT NULL,
        original_channel  TEXT NOT NULL,
        original_user     TEXT NOT NULL,
        workspace_id      TEXT NOT NULL DEFAULT 'default',
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(dm_channel, dm_ts)
      );

      CREATE INDEX IF NOT EXISTS idx_file_analyses_eval ON file_analyses(evaluation_id);
      CREATE INDEX IF NOT EXISTS idx_file_analyses_hash ON file_analyses(file_hash);
      CREATE INDEX IF NOT EXISTS idx_file_analyses_workspace ON file_analyses(workspace_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_detection_events_eval ON detection_events(evaluation_id);
      CREATE INDEX IF NOT EXISTS idx_detection_events_type ON detection_events(workspace_id, event_type, created_at);
      CREATE INDEX IF NOT EXISTS idx_monthly_summaries_ws ON monthly_summaries(workspace_id, month);
      CREATE INDEX IF NOT EXISTS idx_resend_contexts_lookup ON resend_contexts(dm_channel, dm_ts);
      CREATE INDEX IF NOT EXISTS idx_resend_contexts_expiry ON resend_contexts(created_at);
    `);

    // ── Seed excluded channels setting ──
    await client.query(`
      INSERT INTO settings (workspace_id, key, value) VALUES ('default', 'slack.excluded_channels', '')
        ON CONFLICT (workspace_id, key) DO NOTHING;
    `);

    logger.info('Database schema initialized');
  } finally {
    client.release();
  }
}

async function getSetting(key, workspaceId = 'default') {
  const { rows } = await pool.query(
    'SELECT value FROM settings WHERE workspace_id = $1 AND key = $2',
    [workspaceId, key],
  );
  return rows[0]?.value ?? null;
}

async function setSetting(key, value, workspaceId = 'default') {
  await pool.query(
    'INSERT INTO settings (workspace_id, key, value) VALUES ($1, $2, $3) ON CONFLICT (workspace_id, key) DO UPDATE SET value = $3',
    [workspaceId, key, value],
  );
}

async function runRetentionCleanup(workspaceId = 'default') {
  const retentionDays = parseInt(await getSetting('retention_days', workspaceId) || '90', 10);
  if (retentionDays <= 0) return;
  const { rowCount } = await pool.query(
    'DELETE FROM evaluations WHERE workspace_id = $1 AND created_at < now() - make_interval(days => $2)',
    [workspaceId, retentionDays],
  );
  if (rowCount > 0) {
    logger.info({ deletedCount: rowCount, retentionDays, workspaceId }, 'Retention cleanup completed');
  }
}

// ── Resend context helpers (DB-backed, replaces in-memory Map) ───────

const RESEND_TTL_HOURS = 24;

async function saveResendContext(dmChannel, dmTs, originalChannel, originalUser, workspaceId = 'default') {
  try {
    await pool.query(
      `INSERT INTO resend_contexts (dm_channel, dm_ts, original_channel, original_user, workspace_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (dm_channel, dm_ts) DO NOTHING`,
      [dmChannel, dmTs, originalChannel, originalUser, workspaceId],
    );
  } catch (err) {
    logger.error({ err, dmChannel, dmTs }, 'Failed to save resend context');
  }
}

async function getResendContext(dmChannel, dmTs) {
  try {
    const { rows } = await pool.query(
      `SELECT original_channel, original_user, workspace_id, created_at
       FROM resend_contexts
       WHERE dm_channel = $1 AND dm_ts = $2
         AND created_at > now() - make_interval(hours => $3)`,
      [dmChannel, dmTs, RESEND_TTL_HOURS],
    );
    return rows[0] || null;
  } catch (err) {
    logger.error({ err, dmChannel, dmTs }, 'Failed to get resend context');
    return null;
  }
}

async function deleteResendContext(dmChannel, dmTs) {
  try {
    await pool.query(
      'DELETE FROM resend_contexts WHERE dm_channel = $1 AND dm_ts = $2',
      [dmChannel, dmTs],
    );
  } catch (err) {
    logger.error({ err, dmChannel, dmTs }, 'Failed to delete resend context');
  }
}

async function cleanupExpiredResendContexts() {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM resend_contexts WHERE created_at < now() - make_interval(hours => $1)',
      [RESEND_TTL_HOURS],
    );
    if (rowCount > 0) {
      logger.info({ deletedCount: rowCount }, 'Cleaned up expired resend contexts');
    }
  } catch (err) {
    logger.error({ err }, 'Failed to cleanup expired resend contexts');
  }
}

module.exports = {
  pool, initDb, getSetting, setSetting, runRetentionCleanup,
  saveResendContext, getResendContext, deleteResendContext, cleanupExpiredResendContexts,
};

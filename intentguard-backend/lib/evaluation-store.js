const crypto = require('crypto');
const { pool } = require('./db');
const logger = require('./logger');

async function saveEvaluation(event, assessment, platform = 'slack', workspaceId = 'default') {
  try {
    // Guard: skip persistence if no user (e.g. message_changed events from file deletion)
    if (!event.user) {
      logger.debug({ channel: event.channel, ts: event.ts }, 'Skipping evaluation persistence — no user on event');
      return null;
    }

    // Hash message text synchronously BEFORE any await — safe with fire-and-forget pattern
    // (the caller may null event.text after this function is called without await)
    const messageHash = event.text
      ? crypto.createHash('sha256').update(event.text).digest('hex')
      : null;

    // Snapshot file metadata synchronously (before caller nulls file URLs)
    const fileSnapshots = (event.files || []).map((f) => ({
      name: f.name,
      mimetype: f.mimetype || f.filetype || null,
      size: f.size || 0,
    }));

    // Strip sensitive fields from files before persisting
    const safeFiles = (assessment.filesAnalyzed || []).map((f) => ({
      name: f.name,
      method: f.method,
      classificationLabel: f.classificationLabel || 'unknown',
      // NOTE: f.finding is intentionally excluded — it may contain sensitive content descriptions
    }));

    const { rows } = await pool.query(
      `INSERT INTO evaluations
        (workspace_id, platform, slack_user, slack_channel, slack_ts, slack_thread_ts, client_msg_id,
         message_hash, intent_label, intent_confidence,
         match, confidence, mismatch_type, risk_summary,
         files_analyzed, error, context_risk)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING id`,
      [
        workspaceId,
        platform,
        event.user,
        event.channel,
        event.ts,
        event.thread_ts || null,
        event.client_msg_id || null,
        messageHash,
        assessment.intentLabel || 'unknown',
        assessment.intentConfidence ?? 0,
        assessment.match,
        assessment.confidence,
        assessment.mismatchType || 'none',
        assessment.riskSummary || '',
        JSON.stringify(safeFiles),
        assessment.error || null,
        assessment.contextRisk || 'none',
      ],
    );

    const evaluationId = rows[0].id;
    logger.info({ evaluationId, workspaceId }, 'Evaluation persisted');

    // ── Analytics: file_analyses (one row per file) ──
    for (const safeFile of safeFiles) {
      const fileSnap = fileSnapshots.find((f) => f.name === safeFile.name);
      // Find pre-scan signals for this file if any
      const preScanSignals = assessment.preScanFindings
        ? assessment.preScanFindings.filter((f) => !f.fileName || f.fileName === safeFile.name)
        : null;

      await pool.query(
        `INSERT INTO file_analyses
          (evaluation_id, workspace_id, file_name, file_mimetype, file_size,
           analysis_method, classification_label, pre_scan_signals)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          evaluationId,
          workspaceId,
          safeFile.name,
          fileSnap?.mimetype || null,
          fileSnap?.size || 0,
          safeFile.method,
          safeFile.classificationLabel,
          preScanSignals && preScanSignals.length > 0 ? JSON.stringify(preScanSignals) : null,
        ],
      );
    }

    // ── Analytics: detection_event for this scan ──
    const analysisMethod = assessment.analysisMethod || 'llm'; // 'pre-scan' or 'llm'
    await recordEvent(evaluationId, workspaceId, analysisMethod === 'pre-scan' ? 'pre_scan_hit' : 'llm_analysis', {
      match: assessment.match,
      confidence: assessment.confidence,
      mismatchType: assessment.mismatchType || 'none',
      analysisMethod,
      fileCount: safeFiles.length,
    });

    return evaluationId;
  } catch (err) {
    logger.error({ err }, 'Failed to persist evaluation');
    return null;
  }
}

/**
 * Record an immutable detection event for analytics.
 * Fire-and-forget — errors are logged but never thrown.
 */
async function recordEvent(evaluationId, workspaceId, eventType, eventData = {}) {
  try {
    await pool.query(
      `INSERT INTO detection_events (evaluation_id, workspace_id, event_type, event_data)
       VALUES ($1, $2, $3, $4)`,
      [evaluationId, workspaceId, eventType, JSON.stringify(eventData)],
    );
  } catch (err) {
    logger.error({ err, eventType }, 'Failed to record detection event');
  }
}

module.exports = { saveEvaluation, recordEvent };

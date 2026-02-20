const { pool } = require('./db');
const logger = require('./logger');

/**
 * Aggregate current month's data into monthly_summaries.
 * Runs as an upsert — safe to call multiple times per day.
 */
async function rollupMonthlySummary(workspaceId = 'default') {
  const client = await pool.connect();
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStr = monthStart.toISOString().slice(0, 10); // YYYY-MM-01

    // Core evaluation counts
    const evalStats = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE match != 'skipped') AS total_scans,
        COUNT(*) FILTER (WHERE match = 'match') AS matches,
        COUNT(*) FILTER (WHERE match = 'mismatch') AS mismatches,
        COUNT(*) FILTER (WHERE match = 'uncertain') AS uncertain
      FROM evaluations
      WHERE workspace_id = $1
        AND created_at >= $2
        AND created_at < ($2::date + INTERVAL '1 month')
    `, [workspaceId, monthStr]);

    const stats = evalStats.rows[0];

    // File count
    const fileStats = await client.query(`
      SELECT COUNT(*) AS total_files
      FROM file_analyses
      WHERE workspace_id = $1
        AND created_at >= $2
        AND created_at < ($2::date + INTERVAL '1 month')
    `, [workspaceId, monthStr]);

    // Detection method breakdown
    const methodStats = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'pre_scan_hit') AS pre_scan_catches,
        COUNT(*) FILTER (WHERE event_type = 'llm_analysis') AS llm_calls
      FROM detection_events
      WHERE workspace_id = $1
        AND created_at >= $2
        AND created_at < ($2::date + INTERVAL '1 month')
    `, [workspaceId, monthStr]);

    const methods = methodStats.rows[0];

    // Estimated cost saved: each pre-scan catch saves ~$0.002 (avg OpenAI call cost for gpt-4o-mini)
    const costPerCall = 0.002;
    const estimatedCostSaved = (parseInt(methods.pre_scan_catches, 10) || 0) * costPerCall;

    // Top mismatch types
    const mismatchTypes = await client.query(`
      SELECT mismatch_type, COUNT(*) AS cnt
      FROM evaluations
      WHERE workspace_id = $1
        AND match = 'mismatch'
        AND mismatch_type != 'none'
        AND created_at >= $2
        AND created_at < ($2::date + INTERVAL '1 month')
      GROUP BY mismatch_type
      ORDER BY cnt DESC
      LIMIT 10
    `, [workspaceId, monthStr]);

    const topMismatchTypes = {};
    for (const row of mismatchTypes.rows) {
      topMismatchTypes[row.mismatch_type] = parseInt(row.cnt, 10);
    }

    // Top risk channels
    const riskChannels = await client.query(`
      SELECT slack_channel, COUNT(*) AS cnt
      FROM evaluations
      WHERE workspace_id = $1
        AND match = 'mismatch'
        AND created_at >= $2
        AND created_at < ($2::date + INTERVAL '1 month')
      GROUP BY slack_channel
      ORDER BY cnt DESC
      LIMIT 10
    `, [workspaceId, monthStr]);

    const topRiskChannels = {};
    for (const row of riskChannels.rows) {
      topRiskChannels[row.slack_channel] = parseInt(row.cnt, 10);
    }

    // Top risk users
    const riskUsers = await client.query(`
      SELECT slack_user, COUNT(*) AS cnt
      FROM evaluations
      WHERE workspace_id = $1
        AND match = 'mismatch'
        AND created_at >= $2
        AND created_at < ($2::date + INTERVAL '1 month')
      GROUP BY slack_user
      ORDER BY cnt DESC
      LIMIT 10
    `, [workspaceId, monthStr]);

    const topRiskUsers = {};
    for (const row of riskUsers.rows) {
      topRiskUsers[row.slack_user] = parseInt(row.cnt, 10);
    }

    // Upsert monthly summary
    await client.query(`
      INSERT INTO monthly_summaries
        (workspace_id, month, total_scans, total_files, matches, mismatches, uncertain,
         pre_scan_catches, llm_calls, estimated_cost_saved,
         top_mismatch_types, top_risk_channels, top_risk_users)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (workspace_id, month)
      DO UPDATE SET
        total_scans = EXCLUDED.total_scans,
        total_files = EXCLUDED.total_files,
        matches = EXCLUDED.matches,
        mismatches = EXCLUDED.mismatches,
        uncertain = EXCLUDED.uncertain,
        pre_scan_catches = EXCLUDED.pre_scan_catches,
        llm_calls = EXCLUDED.llm_calls,
        estimated_cost_saved = EXCLUDED.estimated_cost_saved,
        top_mismatch_types = EXCLUDED.top_mismatch_types,
        top_risk_channels = EXCLUDED.top_risk_channels,
        top_risk_users = EXCLUDED.top_risk_users
    `, [
      workspaceId, monthStr,
      parseInt(stats.total_scans, 10) || 0,
      parseInt(fileStats.rows[0].total_files, 10) || 0,
      parseInt(stats.matches, 10) || 0,
      parseInt(stats.mismatches, 10) || 0,
      parseInt(stats.uncertain, 10) || 0,
      parseInt(methods.pre_scan_catches, 10) || 0,
      parseInt(methods.llm_calls, 10) || 0,
      estimatedCostSaved,
      JSON.stringify(topMismatchTypes),
      JSON.stringify(topRiskChannels),
      JSON.stringify(topRiskUsers),
    ]);

    logger.info({
      workspaceId, month: monthStr,
      totalScans: stats.total_scans,
      mismatches: stats.mismatches,
      preScanCatches: methods.pre_scan_catches,
      llmCalls: methods.llm_calls,
      estimatedCostSaved,
    }, 'Monthly summary rollup completed');
  } catch (err) {
    logger.error({ err, workspaceId }, 'Monthly summary rollup failed');
  } finally {
    client.release();
  }
}

module.exports = { rollupMonthlySummary };

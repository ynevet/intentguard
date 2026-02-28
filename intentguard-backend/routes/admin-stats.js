const express = require('express');
const { pool } = require('../lib/db');
const { buildNav } = require('../lib/nav');
const logger = require('../lib/logger');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // ── Live stats for current month ──
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);

    // Current month evaluation counts
    const currentStats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE match != 'skipped') AS total_scans,
        COUNT(*) FILTER (WHERE match = 'match') AS matches,
        COUNT(*) FILTER (WHERE match = 'mismatch') AS mismatches,
        COUNT(*) FILTER (WHERE match = 'uncertain') AS uncertain
      FROM evaluations
      WHERE created_at >= $1
    `, [monthStart]);

    // Last month from monthly_summaries (aggregate all workspaces)
    const lastMonthSummary = await pool.query(`
      SELECT
        SUM(total_scans) AS total_scans,
        SUM(mismatches) AS mismatches
      FROM monthly_summaries
      WHERE month = $1
    `, [lastMonthStart]);

    const lastMonth = lastMonthSummary.rows[0] || null;

    // Detection method breakdown (current month)
    const methodBreakdown = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'pre_scan_hit') AS pre_scan,
        COUNT(*) FILTER (WHERE event_type = 'llm_analysis') AS llm
      FROM detection_events
      WHERE created_at >= $1
    `, [monthStart]);

    // File analysis method breakdown
    const fileMethodBreakdown = await pool.query(`
      SELECT analysis_method, COUNT(*) AS cnt
      FROM file_analyses
      WHERE created_at >= $1
      GROUP BY analysis_method
      ORDER BY cnt DESC
    `, [monthStart]);

    // Top mismatch types (current month)
    const mismatchTypes = await pool.query(`
      SELECT mismatch_type, COUNT(*) AS cnt
      FROM evaluations
      WHERE match = 'mismatch' AND mismatch_type != 'none' AND created_at >= $1
      GROUP BY mismatch_type ORDER BY cnt DESC LIMIT 5
    `, [monthStart]);

    // Top risk channels
    const riskChannels = await pool.query(`
      SELECT slack_channel, COUNT(*) AS cnt
      FROM evaluations
      WHERE match = 'mismatch' AND created_at >= $1
      GROUP BY slack_channel ORDER BY cnt DESC LIMIT 5
    `, [monthStart]);

    // Top risk users
    const riskUsers = await pool.query(`
      SELECT slack_user, COUNT(*) AS cnt
      FROM evaluations
      WHERE match = 'mismatch' AND created_at >= $1
      GROUP BY slack_user ORDER BY cnt DESC LIMIT 5
    `, [monthStart]);

    // File type breakdown
    const fileTypes = await pool.query(`
      SELECT classification_label, COUNT(*) AS cnt
      FROM file_analyses
      WHERE created_at >= $1 AND classification_label IS NOT NULL AND classification_label != 'unknown'
      GROUP BY classification_label ORDER BY cnt DESC LIMIT 10
    `, [monthStart]);

    // Action events summary
    const actionStats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'file_deleted') AS files_deleted,
        COUNT(*) FILTER (WHERE event_type = 'dm_sent') AS dms_sent,
        COUNT(*) FILTER (WHERE event_type = 'user_resent') AS user_resends
      FROM detection_events
      WHERE created_at >= $1
    `, [monthStart]);

    // Build the page
    const cur = currentStats.rows[0];
    const methods = methodBreakdown.rows[0];
    const actions = actionStats.rows[0];

    const totalScans = parseInt(cur.total_scans, 10) || 0;
    const mismatches = parseInt(cur.mismatches, 10) || 0;
    const matches = parseInt(cur.matches, 10) || 0;
    const uncertain = parseInt(cur.uncertain, 10) || 0;
    const preScanCount = parseInt(methods.pre_scan, 10) || 0;
    const llmCount = parseInt(methods.llm, 10) || 0;
    const costSaved = (preScanCount * 0.002).toFixed(4);

    // Trend vs last month
    const lastTotal = lastMonth ? parseInt(lastMonth.total_scans, 10) || 0 : 0;
    const lastMismatches = lastMonth ? parseInt(lastMonth.mismatches, 10) || 0 : 0;
    const scanTrend = lastTotal > 0 ? Math.round(((totalScans - lastTotal) / lastTotal) * 100) : 0;
    const mismatchTrend = lastMismatches > 0 ? Math.round(((mismatches - lastMismatches) / lastMismatches) * 100) : 0;

    function trendArrow(pct) {
      if (pct > 0) return `<span style="color:#f85149;">&#9650; ${pct}%</span>`;
      if (pct < 0) return `<span style="color:#3fb950;">&#9660; ${Math.abs(pct)}%</span>`;
      return '<span style="color:#768390;">&mdash;</span>';
    }

    function buildListRows(rows) {
      if (!rows || rows.length === 0) return '<tr><td colspan="2" style="color:#768390;">No data yet</td></tr>';
      return rows.map((r) => {
        const label = r.mismatch_type || r.slack_channel || r.slack_user || r.classification_label || r.analysis_method || 'unknown';
        const count = parseInt(r.cnt, 10);
        return `<tr><td>${escapeHtml(label)}</td><td style="text-align:right;font-weight:600;">${count}</td></tr>`;
      }).join('');
    }

    function escapeHtml(str) {
      return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Intentify AI — Stats</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #e6edf3; }
    .content { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .meta { color: #768390; margin-bottom: 24px; font-size: 14px; }

    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .stat-card {
      background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 20px;
    }
    .stat-card .label { font-size: 13px; color: #768390; margin-bottom: 4px; }
    .stat-card .value { font-size: 28px; font-weight: 700; }
    .stat-card .trend { font-size: 13px; margin-top: 4px; }

    .panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .panel {
      background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 20px;
    }
    .panel h2 { font-size: 15px; margin-bottom: 12px; border-bottom: 1px solid #21262d; padding-bottom: 8px; }
    .panel table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .panel table td { padding: 6px 8px; border-bottom: 1px solid #21262d; }
    .panel table tr:last-child td { border-bottom: none; }

    .bar-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .bar-label { font-size: 13px; min-width: 110px; color: #8b949e; }
    .bar-track { flex: 1; height: 20px; background: #21262d; border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
    .bar-count { font-size: 13px; min-width: 40px; text-align: right; font-weight: 600; }

    .detection-bar .pre-scan { background: #3fb950; }
    .detection-bar .llm { background: #58a6ff; }

    .match-green { color: #3fb950; }
    .match-red { color: #f85149; }
    .match-orange { color: #d29922; }
  </style>
</head>
<body>
  ${buildNav('stats', req.session)}
  <div class="content">
    <h1>Analytics Dashboard</h1>
    <p class="meta">Current month overview &mdash; ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="label">Total Scans</div>
        <div class="value">${totalScans}</div>
        <div class="trend">vs last month: ${trendArrow(scanTrend)}</div>
      </div>
      <div class="stat-card">
        <div class="label">Mismatches Caught</div>
        <div class="value match-red">${mismatches}</div>
        <div class="trend">vs last month: ${trendArrow(mismatchTrend)}</div>
      </div>
      <div class="stat-card">
        <div class="label">Pre-scan Catches</div>
        <div class="value match-green">${preScanCount}</div>
        <div class="trend">LLM calls saved</div>
      </div>
      <div class="stat-card">
        <div class="label">Est. Cost Saved</div>
        <div class="value match-green">$${costSaved}</div>
        <div class="trend">${preScanCount} x $0.002/call</div>
      </div>
      <div class="stat-card">
        <div class="label">Files Deleted</div>
        <div class="value">${parseInt(actions.files_deleted, 10) || 0}</div>
      </div>
      <div class="stat-card">
        <div class="label">DMs Sent</div>
        <div class="value">${parseInt(actions.dms_sent, 10) || 0}</div>
      </div>
    </div>

    <h2 style="font-size:18px;margin-bottom:16px;">Detection Breakdown</h2>
    <div style="background:#161b22;border:1px solid #21262d;border-radius:8px;padding:20px;margin-bottom:32px;">
      <div class="bar-row detection-bar">
        <div class="bar-label">Pre-scan</div>
        <div class="bar-track">
          <div class="bar-fill pre-scan" style="width:${totalScans > 0 ? Math.round((preScanCount / (preScanCount + llmCount || 1)) * 100) : 0}%;"></div>
        </div>
        <div class="bar-count">${preScanCount}</div>
      </div>
      <div class="bar-row detection-bar">
        <div class="bar-label">LLM (OpenAI)</div>
        <div class="bar-track">
          <div class="bar-fill llm" style="width:${totalScans > 0 ? Math.round((llmCount / (preScanCount + llmCount || 1)) * 100) : 0}%;"></div>
        </div>
        <div class="bar-count">${llmCount}</div>
      </div>
    </div>

    <div class="panels">
      <div class="panel">
        <h2>Verdicts</h2>
        <div class="bar-row">
          <div class="bar-label">Match</div>
          <div class="bar-track"><div class="bar-fill" style="background:#3fb950;width:${totalScans > 0 ? Math.round((matches / totalScans) * 100) : 0}%;"></div></div>
          <div class="bar-count">${matches}</div>
        </div>
        <div class="bar-row">
          <div class="bar-label">Mismatch</div>
          <div class="bar-track"><div class="bar-fill" style="background:#f85149;width:${totalScans > 0 ? Math.round((mismatches / totalScans) * 100) : 0}%;"></div></div>
          <div class="bar-count">${mismatches}</div>
        </div>
        <div class="bar-row">
          <div class="bar-label">Uncertain</div>
          <div class="bar-track"><div class="bar-fill" style="background:#d29922;width:${totalScans > 0 ? Math.round((uncertain / totalScans) * 100) : 0}%;"></div></div>
          <div class="bar-count">${uncertain}</div>
        </div>
      </div>

      <div class="panel">
        <h2>Top Mismatch Types</h2>
        <table>${buildListRows(mismatchTypes.rows)}</table>
      </div>

      <div class="panel">
        <h2>Riskiest Channels</h2>
        <table>${buildListRows(riskChannels.rows)}</table>
      </div>

      <div class="panel">
        <h2>Riskiest Users</h2>
        <table>${buildListRows(riskUsers.rows)}</table>
      </div>

      <div class="panel">
        <h2>File Analysis Methods</h2>
        <table>${buildListRows(fileMethodBreakdown.rows)}</table>
      </div>

      <div class="panel">
        <h2>File Classifications</h2>
        <table>${buildListRows(fileTypes.rows)}</table>
      </div>
    </div>
  </div>
</body>
</html>`);
  } catch (err) {
    logger.error({ err }, 'Failed to load stats dashboard');
    res.status(500).send('Internal server error');
  }
});

module.exports = router;

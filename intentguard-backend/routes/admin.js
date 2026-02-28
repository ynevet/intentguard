const express = require('express');
const { pool, getSetting, setSetting } = require('../lib/db');
const { buildNav } = require('../lib/nav');
const logger = require('../lib/logger');

const router = express.Router();
const DEFAULT_PAGE_SIZE = 25;

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function matchBadge(match) {
  const colors = {
    match: '#2ea043',
    mismatch: '#da3633',
    uncertain: '#d29922',
    skipped: '#768390',
  };
  const color = colors[match] || '#768390';
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:13px;">${escapeHtml(match)}</span>`;
}

function mismatchTypeBadge(type) {
  if (!type || type === 'none') return '<span style="color:#768390;">—</span>';
  const labels = {
    intent_vs_content: 'Intent vs Content',
    wrong_audience: 'Wrong Audience',
    pii_exposure: 'PII Exposure',
    credential_leak: 'Credential Leak',
    sensitive_in_public: 'Sensitive in Public',
    external_leak: 'External Leak',
    unknown_legacy: 'Legacy',
  };
  const label = labels[type] || type;
  return `<span style="background:#da3633;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">${escapeHtml(label)}</span>`;
}

router.get('/settings', async (req, res) => {
  try {
    const analysisEnabled = await getSetting('analysis_enabled', req.workspaceId) || 'true';
    const retentionDays = await getSetting('retention_days', req.workspaceId) || '90';
    res.json({
      analysis_enabled: analysisEnabled === 'true',
      retention_days: parseInt(retentionDays, 10),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to load settings');
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.post('/settings', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    // Analysis enabled (checkbox: present = true, absent = false)
    const analysisEnabled = req.body.analysis_enabled === 'on' ? 'true' : 'false';
    await setSetting('analysis_enabled', analysisEnabled, req.workspaceId);

    // Retention days
    const retentionDays = parseInt(req.body.retention_days, 10);
    if (Number.isNaN(retentionDays) || retentionDays < 0 || retentionDays > 3650) {
      return res.status(400).send('Retention days must be between 0 and 3650');
    }
    await setSetting('retention_days', String(retentionDays), req.workspaceId);

    logger.info({ analysis_enabled: analysisEnabled, retention_days: retentionDays }, 'Global settings updated');
    res.redirect('/admin/evaluations?saved=1');
  } catch (err) {
    logger.error({ err }, 'Failed to save settings');
    res.status(500).send('Failed to save settings');
  }
});

router.get('/evaluations', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const saved = req.query.saved === '1';
    const analysisEnabled = (await getSetting('analysis_enabled', req.workspaceId) || 'true') === 'true';
    const retentionDays = await getSetting('retention_days', req.workspaceId) || '90';
    const limit = DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      "SELECT COUNT(*) FROM evaluations WHERE match != 'skipped'",
    );
    const total = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const { rows } = await pool.query(
      "SELECT * FROM evaluations WHERE match != 'skipped' ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset],
    );

    const tableRows = rows.map((r) => {
      const files = JSON.parse(JSON.stringify(r.files_analyzed || []));
      const filesSummary = files.map((f) => {
        const cl = f.classificationLabel || f.classification_label || '';
        const clBadge = cl && cl !== 'unknown' && cl !== 'unknown_legacy'
          ? ` <span style="color:#58a6ff;font-size:11px;">[${escapeHtml(cl)}]</span>`
          : '';
        return `${escapeHtml(f.name)} (${escapeHtml(f.method)})${clBadge}`;
      }).join('<br>');
      const created = new Date(r.created_at).toLocaleString();
      const ctxRisk = r.context_risk || 'none';
      const ctxColors = { none: '#768390', low: '#2ea043', medium: '#d29922', high: '#da3633' };
      const ctxColor = ctxColors[ctxRisk] || '#768390';
      const ctxBadge = `<span style="background:${ctxColor};color:#fff;padding:2px 8px;border-radius:4px;font-size:13px;">${escapeHtml(ctxRisk)}</span>`;

      return `<tr>
        <td>${r.id}</td>
        <td>${created}</td>
        <td>${escapeHtml(r.workspace_id)}</td>
        <td>${escapeHtml(r.slack_user)}</td>
        <td>${escapeHtml(r.slack_channel)}</td>
        <td>${matchBadge(r.match)}</td>
        <td>${Math.round(r.confidence * 100)}%</td>
        <td>${ctxBadge}</td>
        <td>${escapeHtml(r.intent_label || '—')}</td>
        <td>${mismatchTypeBadge(r.mismatch_type)}</td>
        <td style="max-width:300px;word-wrap:break-word;">${escapeHtml(r.risk_summary || '—')}</td>
        <td>${filesSummary}</td>
        <td>${escapeHtml(r.error)}</td>
      </tr>`;
    }).join('\n');

    const pageLinks = [];
    if (page > 1) {
      pageLinks.push(`<a href="?page=${page - 1}">&laquo; Prev</a>`);
    }
    for (let p = 1; p <= totalPages; p++) {
      if (p === page) {
        pageLinks.push(`<span class="current">${p}</span>`);
      } else {
        pageLinks.push(`<a href="?page=${p}">${p}</a>`);
      }
    }
    if (page < totalPages) {
      pageLinks.push(`<a href="?page=${page + 1}">Next &raquo;</a>`);
    }

    const from = total === 0 ? 0 : offset + 1;
    const to = Math.min(offset + limit, total);

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Intentify AI — Admin Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #e6edf3; }
    .content { padding: 24px; }
    h1 { margin-bottom: 16px; font-size: 24px; }
    .meta { color: #768390; margin-bottom: 16px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #21262d; }
    th { background: #161b22; position: sticky; top: 0; white-space: nowrap; }
    tr:hover { background: #161b22; }
    td { vertical-align: top; }
    .pagination { margin-top: 16px; display: flex; gap: 4px; align-items: center; }
    .pagination a, .pagination .current { padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 14px; }
    .pagination a { background: #21262d; color: #e6edf3; }
    .pagination a:hover { background: #30363d; }
    .pagination .current { background: #1f6feb; color: #fff; }
    .settings { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 20px; margin-bottom: 12px; }
    .settings h2 { font-size: 16px; margin-bottom: 16px; color: #e6edf3; }
    .settings .field { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    .settings .field:last-of-type { margin-bottom: 16px; }
    .settings label { font-size: 14px; color: #e6edf3; min-width: 200px; }
    .settings input[type="number"] { width: 70px; padding: 6px 8px; border-radius: 4px; border: 1px solid #30363d; background: #0d1117; color: #e6edf3; font-size: 14px; }
    .settings input[type="checkbox"] { width: 18px; height: 18px; accent-color: #1f6feb; }
    .settings button { padding: 6px 16px; border-radius: 4px; border: none; background: #1f6feb; color: #fff; font-size: 14px; cursor: pointer; }
    .settings button:hover { background: #388bfd; }
    .settings .hint { font-size: 12px; color: #768390; }
    .toast { background: #2ea043; color: #fff; padding: 8px 16px; border-radius: 4px; font-size: 14px; display: inline-block; margin-bottom: 12px; }
    .table-wrap { overflow-x: auto; }
    .integration-link { font-size: 13px; color: #8b949e; margin-bottom: 20px; }
    .integration-link a { color: #58a6ff; text-decoration: none; }
    .integration-link a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  ${buildNav('admin', req.session)}
  <div class="content">
  <h1>Evaluation History</h1>
  <p class="meta" style="margin-bottom:8px;">Audit trail of all file verification results.</p>
  <p class="meta">Showing ${from}–${to} of ${total} evaluation(s) &middot; Page ${page} of ${totalPages}</p>
  ${saved ? '<div class="toast">Settings saved</div>' : ''}
  <form class="settings" method="POST" action="/admin/settings">
    <h2>Global Settings</h2>
    <div class="field">
      <label for="analysis_enabled">Analysis enabled</label>
      <input type="checkbox" id="analysis_enabled" name="analysis_enabled" ${analysisEnabled ? 'checked' : ''}>
      <span class="hint">When off, Intentify AI will not analyze any messages.</span>
    </div>
    <div class="field">
      <label for="retention_days">Data retention (days)</label>
      <input type="number" id="retention_days" name="retention_days" min="0" max="3650" value="${escapeHtml(retentionDays)}">
      <span class="hint">Evaluations older than this are automatically deleted. 0 = keep forever.</span>
    </div>
    <button type="submit">Save</button>
  </form>
  <p class="integration-link">Platform-specific settings: <a href="/admin/integrations/slack">Slack</a></p>
  <div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Time</th>
        <th>Workspace</th>
        <th>User</th>
        <th>Channel</th>
        <th>Match</th>
        <th>Confidence</th>
        <th>Ctx Risk</th>
        <th>Intent</th>
        <th>Mismatch Type</th>
        <th>Risk Summary</th>
        <th>Files</th>
        <th>Error</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || '<tr><td colspan="13" style="text-align:center;padding:24px;">No evaluations yet</td></tr>'}
    </tbody>
  </table>
  </div>
  <div class="pagination">${pageLinks.join('\n    ')}</div>
  </div>
</body>
</html>`);
  } catch (err) {
    logger.error({ err }, 'Failed to load evaluations page');
    res.status(500).send('Internal server error');
  }
});

module.exports = router;

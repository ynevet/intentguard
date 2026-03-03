const express = require('express');
const { pool } = require('../lib/db');
const { buildNav } = require('../lib/nav');
const logger = require('../lib/logger');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    // ── Headline stats (exclude bots) ──
    const headline = await pool.query(`
      SELECT
        COUNT(*) AS total_views,
        COUNT(DISTINCT visitor_id) AS unique_visitors,
        COUNT(DISTINCT session_id) AS unique_sessions
      FROM page_views
      WHERE created_at >= $1 AND device_type != 'bot'
    `, [monthStart]);

    const topReferrerResult = await pool.query(`
      SELECT referrer_host, COUNT(*) AS cnt
      FROM page_views
      WHERE created_at >= $1 AND device_type != 'bot' AND referrer_host IS NOT NULL
      GROUP BY referrer_host ORDER BY cnt DESC LIMIT 1
    `, [monthStart]);

    // ── Views by page ──
    const viewsByPage = await pool.query(`
      SELECT path, COUNT(*) AS cnt
      FROM page_views
      WHERE created_at >= $1 AND device_type != 'bot'
      GROUP BY path ORDER BY cnt DESC
    `, [monthStart]);

    // ── Traffic sources ──
    const trafficSources = await pool.query(`
      SELECT referrer_host, COUNT(*) AS cnt
      FROM page_views
      WHERE created_at >= $1 AND device_type != 'bot' AND referrer_host IS NOT NULL
      GROUP BY referrer_host ORDER BY cnt DESC LIMIT 10
    `, [monthStart]);

    // ── UTM campaigns ──
    const utmCampaigns = await pool.query(`
      SELECT utm_source, utm_medium, utm_campaign, COUNT(*) AS cnt
      FROM page_views
      WHERE created_at >= $1 AND device_type != 'bot' AND utm_source IS NOT NULL
      GROUP BY utm_source, utm_medium, utm_campaign ORDER BY cnt DESC LIMIT 10
    `, [monthStart]);

    // ── Browsers ──
    const browsers = await pool.query(`
      SELECT browser, COUNT(*) AS cnt
      FROM page_views
      WHERE created_at >= $1 AND device_type != 'bot'
      GROUP BY browser ORDER BY cnt DESC
    `, [monthStart]);

    // ── Operating systems ──
    const operatingSystems = await pool.query(`
      SELECT os, COUNT(*) AS cnt
      FROM page_views
      WHERE created_at >= $1 AND device_type != 'bot'
      GROUP BY os ORDER BY cnt DESC
    `, [monthStart]);

    // ── Device types (include bots here) ──
    const deviceTypes = await pool.query(`
      SELECT device_type, COUNT(*) AS cnt
      FROM page_views
      WHERE created_at >= $1
      GROUP BY device_type ORDER BY cnt DESC
    `, [monthStart]);

    // ── Daily views (current month, exclude bots) ──
    const dailyViews = await pool.query(`
      SELECT created_at::date AS day, COUNT(*) AS cnt
      FROM page_views
      WHERE created_at >= $1 AND device_type != 'bot'
      GROUP BY day ORDER BY day DESC
    `, [monthStart]);

    // ── Build page ──
    const h = headline.rows[0];
    const totalViews = parseInt(h.total_views, 10) || 0;
    const uniqueVisitors = parseInt(h.unique_visitors, 10) || 0;
    const uniqueSessions = parseInt(h.unique_sessions, 10) || 0;
    const topReferrer = topReferrerResult.rows[0]?.referrer_host || 'Direct';

    function esc(str) {
      return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function tableRows(rows, labelFn) {
      if (!rows || rows.length === 0) return '<tr><td colspan="2" style="color:#768390;">No data yet</td></tr>';
      return rows.map(r => {
        const label = labelFn(r);
        const count = parseInt(r.cnt, 10);
        return `<tr><td>${esc(label)}</td><td style="text-align:right;font-weight:600;">${count}</td></tr>`;
      }).join('');
    }

    function barRows(rows, labelKey, maxCount) {
      if (!rows || rows.length === 0) return '<div style="color:#768390;font-size:14px;">No data yet</div>';
      const max = maxCount || Math.max(...rows.map(r => parseInt(r.cnt, 10)), 1);
      return rows.map(r => {
        const label = r[labelKey] || 'Unknown';
        const count = parseInt(r.cnt, 10);
        const pct = Math.round((count / max) * 100);
        return `<div class="bar-row">
          <div class="bar-label">${esc(label)}</div>
          <div class="bar-track"><div class="bar-fill" style="background:#58a6ff;width:${pct}%;"></div></div>
          <div class="bar-count">${count}</div>
        </div>`;
      }).join('');
    }

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Intentify AI — Page Analytics</title>
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
    .stat-card .sub { font-size: 13px; color: #768390; margin-top: 4px; }

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
  </style>
</head>
<body>
  ${buildNav('analytics', req.session)}
  <div class="content">
    <h1>Page Analytics</h1>
    <p class="meta">Public page traffic &mdash; ${now.toLocaleString('default', { month: 'long', year: 'numeric' })} (excludes bots)</p>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="label">Page Views</div>
        <div class="value">${totalViews}</div>
        <div class="sub">This month</div>
      </div>
      <div class="stat-card">
        <div class="label">Unique Visitors</div>
        <div class="value">${uniqueVisitors}</div>
        <div class="sub">Distinct fingerprints</div>
      </div>
      <div class="stat-card">
        <div class="label">Sessions</div>
        <div class="value">${uniqueSessions}</div>
        <div class="sub">30-min window</div>
      </div>
      <div class="stat-card">
        <div class="label">Top Referrer</div>
        <div class="value" style="font-size:18px;">${esc(topReferrer)}</div>
        <div class="sub">Most common source</div>
      </div>
    </div>

    <div class="panels">
      <div class="panel">
        <h2>Views by Page</h2>
        <table>${tableRows(viewsByPage.rows, r => r.path)}</table>
      </div>

      <div class="panel">
        <h2>Traffic Sources</h2>
        <table>${tableRows(trafficSources.rows, r => r.referrer_host)}</table>
      </div>

      <div class="panel">
        <h2>UTM Campaigns</h2>
        <table>
          ${utmCampaigns.rows.length === 0
            ? '<tr><td colspan="2" style="color:#768390;">No data yet</td></tr>'
            : utmCampaigns.rows.map(r => {
                const label = [r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).join(' / ');
                return `<tr><td>${esc(label)}</td><td style="text-align:right;font-weight:600;">${parseInt(r.cnt, 10)}</td></tr>`;
              }).join('')
          }
        </table>
      </div>

      <div class="panel">
        <h2>Daily Views</h2>
        <table>
          ${dailyViews.rows.length === 0
            ? '<tr><td colspan="2" style="color:#768390;">No data yet</td></tr>'
            : dailyViews.rows.map(r => {
                const day = new Date(r.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return `<tr><td>${esc(day)}</td><td style="text-align:right;font-weight:600;">${parseInt(r.cnt, 10)}</td></tr>`;
              }).join('')
          }
        </table>
      </div>
    </div>

    <h2 style="font-size:18px;margin-bottom:16px;">Visitor Breakdown</h2>
    <div class="panels">
      <div class="panel">
        <h2>Browsers</h2>
        ${barRows(browsers.rows, 'browser')}
      </div>

      <div class="panel">
        <h2>Operating Systems</h2>
        ${barRows(operatingSystems.rows, 'os')}
      </div>

      <div class="panel">
        <h2>Device Types</h2>
        ${barRows(deviceTypes.rows, 'device_type')}
      </div>
    </div>
  </div>
</body>
</html>`);
  } catch (err) {
    logger.error({ err }, 'Failed to load analytics dashboard');
    res.status(500).send('Internal server error');
  }
});

module.exports = router;

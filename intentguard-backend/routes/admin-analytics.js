const express = require('express');
const { pool } = require('../lib/db');
const { buildNav } = require('../lib/nav');
const logger = require('../lib/logger');

const router = express.Router();

// ── Traffic source classifier ─────────────────────────────────────────
const SOURCE_CATEGORIES = [
  // Search engines
  { label: '🔍 Google', pattern: /google\./i },
  { label: '🔍 Bing', pattern: /bing\.com/i },
  { label: '🔍 DuckDuckGo', pattern: /duckduckgo\.com/i },
  { label: '🔍 Yahoo', pattern: /yahoo\.com/i },
  { label: '🔍 Baidu', pattern: /baidu\.com/i },
  { label: '🔍 Yandex', pattern: /yandex\./i },
  { label: '🔍 Ecosia', pattern: /ecosia\.org/i },
  { label: '🔍 Brave Search', pattern: /search\.brave\.com/i },
  // LLMs & AI
  { label: '🤖 ChatGPT', pattern: /chat\.openai\.com|chatgpt\.com/i },
  { label: '🤖 Claude', pattern: /claude\.ai/i },
  { label: '🤖 Perplexity', pattern: /perplexity\.ai/i },
  { label: '🤖 Gemini', pattern: /gemini\.google\.com/i },
  { label: '🤖 Copilot', pattern: /copilot\.microsoft\.com/i },
  { label: '🤖 You.com', pattern: /you\.com/i },
  { label: '🤖 Grok', pattern: /grok\.x\.com|x\.ai/i },
  { label: '🤖 Phind', pattern: /phind\.com/i },
  // Social
  { label: '💼 LinkedIn', pattern: /linkedin\.com/i },
  { label: '🐦 Twitter/X', pattern: /t\.co|twitter\.com|x\.com/i },
  { label: '▶️ YouTube', pattern: /youtube\.com|youtu\.be/i },
  { label: '📘 Facebook', pattern: /facebook\.com|fb\.me/i },
  { label: '🧡 Reddit', pattern: /reddit\.com|redd\.it/i },
  { label: '💬 Hacker News', pattern: /news\.ycombinator\.com/i },
  { label: '🐙 GitHub', pattern: /github\.com/i },
  { label: '💬 Slack', pattern: /slack\.com/i },
  // Newsletters / link aggregators
  { label: '📧 Substack', pattern: /substack\.com/i },
  { label: '📧 Beehiiv', pattern: /beehiiv\.com/i },
  { label: '🔖 Product Hunt', pattern: /producthunt\.com/i },
];

function classifyReferrer(host) {
  if (!host) return null;
  for (const { label, pattern } of SOURCE_CATEGORIES) {
    if (pattern.test(host)) return label;
  }
  return null;
}

// Country code → flag emoji + full name
const COUNTRY_NAMES = {
  US: '🇺🇸 United States', GB: '🇬🇧 United Kingdom', DE: '🇩🇪 Germany', FR: '🇫🇷 France',
  CA: '🇨🇦 Canada', AU: '🇦🇺 Australia', IN: '🇮🇳 India', NL: '🇳🇱 Netherlands',
  SG: '🇸🇬 Singapore', JP: '🇯🇵 Japan', BR: '🇧🇷 Brazil', IL: '🇮🇱 Israel',
  SE: '🇸🇪 Sweden', NO: '🇳🇴 Norway', CH: '🇨🇭 Switzerland', ES: '🇪🇸 Spain',
  IT: '🇮🇹 Italy', PL: '🇵🇱 Poland', KR: '🇰🇷 South Korea', MX: '🇲🇽 Mexico',
  ZA: '🇿🇦 South Africa', NG: '🇳🇬 Nigeria', RU: '🇷🇺 Russia', CN: '🇨🇳 China',
  HK: '🇭🇰 Hong Kong', NZ: '🇳🇿 New Zealand', IE: '🇮🇪 Ireland', DK: '🇩🇰 Denmark',
  FI: '🇫🇮 Finland', PT: '🇵🇹 Portugal', AT: '🇦🇹 Austria', BE: '🇧🇪 Belgium',
  AR: '🇦🇷 Argentina', CL: '🇨🇱 Chile', CO: '🇨🇴 Colombia', EG: '🇪🇬 Egypt',
  UAE: '🇦🇪 UAE', TR: '🇹🇷 Turkey', PK: '🇵🇰 Pakistan', ID: '🇮🇩 Indonesia',
};

function countryLabel(code) {
  return COUNTRY_NAMES[code] || `🌍 ${code}`;
}

router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    // Run all queries in parallel
    const [
      headlineResult,
      engagementResult,
      newVsReturningResult,
      viewsByPage,
      trafficSourcesRaw,
      utmCampaigns,
      browsers,
      operatingSystems,
      deviceTypes,
      countries,
      dailyViews,
    ] = await Promise.all([
      // ── Headline stats (exclude bots) ──
      pool.query(`
        SELECT
          COUNT(*) AS total_views,
          COUNT(DISTINCT visitor_id) AS unique_visitors,
          COUNT(DISTINCT session_id) AS unique_sessions
        FROM page_views
        WHERE created_at >= $1 AND device_type != 'bot'
      `, [monthStart]),

      // ── Engagement: bounce rate (sessions with only 1 view) + pages/session ──
      pool.query(`
        SELECT
          COUNT(*) AS total_sessions,
          COUNT(*) FILTER (WHERE view_count = 1) AS bounce_sessions,
          ROUND(AVG(view_count), 2) AS avg_pages_per_session
        FROM (
          SELECT session_id, COUNT(*) AS view_count
          FROM page_views
          WHERE created_at >= $1 AND device_type != 'bot'
          GROUP BY session_id
        ) s
      `, [monthStart]),

      // ── New vs returning visitors ──
      pool.query(`
        SELECT
          COUNT(DISTINCT visitor_id) FILTER (WHERE first_seen >= $1) AS new_visitors,
          COUNT(DISTINCT visitor_id) FILTER (WHERE first_seen < $1) AS returning_visitors
        FROM (
          SELECT visitor_id, MIN(created_at) AS first_seen
          FROM page_views
          WHERE device_type != 'bot'
          GROUP BY visitor_id
        ) v
        WHERE v.visitor_id IN (
          SELECT DISTINCT visitor_id FROM page_views WHERE created_at >= $1 AND device_type != 'bot'
        )
      `, [monthStart]),

      // ── Views by page ──
      pool.query(`
        SELECT path, COUNT(*) AS cnt
        FROM page_views
        WHERE created_at >= $1 AND device_type != 'bot'
        GROUP BY path ORDER BY cnt DESC
      `, [monthStart]),

      // ── Traffic sources (raw, top 20 for category aggregation) ──
      pool.query(`
        SELECT referrer_host, COUNT(*) AS cnt
        FROM page_views
        WHERE created_at >= $1 AND device_type != 'bot' AND referrer_host IS NOT NULL
        GROUP BY referrer_host ORDER BY cnt DESC LIMIT 20
      `, [monthStart]),

      // ── UTM campaigns ──
      pool.query(`
        SELECT utm_source, utm_medium, utm_campaign, COUNT(*) AS cnt
        FROM page_views
        WHERE created_at >= $1 AND device_type != 'bot' AND utm_source IS NOT NULL
        GROUP BY utm_source, utm_medium, utm_campaign ORDER BY cnt DESC LIMIT 10
      `, [monthStart]),

      // ── Browsers ──
      pool.query(`
        SELECT browser, COUNT(*) AS cnt
        FROM page_views
        WHERE created_at >= $1 AND device_type != 'bot'
        GROUP BY browser ORDER BY cnt DESC
      `, [monthStart]),

      // ── Operating systems ──
      pool.query(`
        SELECT os, COUNT(*) AS cnt
        FROM page_views
        WHERE created_at >= $1 AND device_type != 'bot'
        GROUP BY os ORDER BY cnt DESC
      `, [monthStart]),

      // ── Device types (include bots to show bot traffic) ──
      pool.query(`
        SELECT device_type, COUNT(*) AS cnt
        FROM page_views
        WHERE created_at >= $1
        GROUP BY device_type ORDER BY cnt DESC
      `, [monthStart]),

      // ── Countries ──
      pool.query(`
        SELECT country, COUNT(*) AS cnt
        FROM page_views
        WHERE created_at >= $1 AND device_type != 'bot' AND country IS NOT NULL
        GROUP BY country ORDER BY cnt DESC LIMIT 15
      `, [monthStart]),

      // ── Daily views (current month, exclude bots, ascending for chart) ──
      pool.query(`
        SELECT created_at::date AS day, COUNT(*) AS cnt
        FROM page_views
        WHERE created_at >= $1 AND device_type != 'bot'
        GROUP BY day ORDER BY day ASC
      `, [monthStart]),
    ]);

    // ── Computed stats ──
    const h = headlineResult.rows[0];
    const totalViews = parseInt(h.total_views, 10) || 0;
    const uniqueVisitors = parseInt(h.unique_visitors, 10) || 0;
    const uniqueSessions = parseInt(h.unique_sessions, 10) || 0;

    const eng = engagementResult.rows[0];
    const totalSessions = parseInt(eng.total_sessions, 10) || 0;
    const bounceSessions = parseInt(eng.bounce_sessions, 10) || 0;
    const bounceRate = totalSessions > 0 ? Math.round((bounceSessions / totalSessions) * 100) : 0;
    const avgPagesPerSession = parseFloat(eng.avg_pages_per_session) || 0;

    const nvr = newVsReturningResult.rows[0];
    const newVisitors = parseInt(nvr?.new_visitors, 10) || 0;
    const returningVisitors = parseInt(nvr?.returning_visitors, 10) || 0;

    // ── Categorize traffic sources ──
    const channelMap = new Map(); // label → count
    let directCount = totalViews; // start with all views, subtract referred
    for (const row of trafficSourcesRaw.rows) {
      const category = classifyReferrer(row.referrer_host);
      const cnt = parseInt(row.cnt, 10);
      if (category) {
        channelMap.set(category, (channelMap.get(category) || 0) + cnt);
      } else {
        // Unknown referrer — bucket as "🌐 Other" with the raw hostname
        channelMap.set(`🌐 ${row.referrer_host}`, cnt);
      }
      directCount -= cnt;
    }
    // Add direct (no referrer) at the top
    const directViews = Math.max(0, directCount);
    const trafficChannels = [
      ...(directViews > 0 ? [{ label: '⬆️ Direct / None', cnt: directViews }] : []),
      ...[...channelMap.entries()]
        .map(([label, cnt]) => ({ label, cnt }))
        .sort((a, b) => b.cnt - a.cnt),
    ];

    const trafficSources = trafficSourcesRaw; // keep for raw panel
    const topReferrer = trafficSourcesRaw.rows[0]?.referrer_host || 'Direct';

    // ── Helpers ──
    function esc(str) {
      return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function tableRows(rows, labelFn) {
      if (!rows || rows.length === 0) return '<tr><td colspan="2" style="color:#768390;">No data yet</td></tr>';
      const max = Math.max(...rows.map(r => parseInt(r.cnt, 10)), 1);
      return rows.map(r => {
        const label = labelFn(r);
        const count = parseInt(r.cnt, 10);
        const pct = Math.round((count / max) * 100);
        return `<tr>
          <td>
            ${esc(label)}
            <div style="margin-top:4px;height:4px;background:#21262d;border-radius:2px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:#58a6ff;border-radius:2px;"></div>
            </div>
          </td>
          <td style="text-align:right;font-weight:600;white-space:nowrap;">${count}</td>
        </tr>`;
      }).join('');
    }

    function barRows(rows, labelKey) {
      if (!rows || rows.length === 0) return '<div style="color:#768390;font-size:14px;">No data yet</div>';
      const max = Math.max(...rows.map(r => parseInt(r.cnt, 10)), 1);
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

    // ── Daily views sparkline (SVG) ──
    function dailySparkline(rows) {
      if (!rows || rows.length === 0) return '<div style="color:#768390;font-size:14px;">No data yet</div>';
      const counts = rows.map(r => parseInt(r.cnt, 10));
      const maxVal = Math.max(...counts, 1);
      const w = 600; const h = 80; const barW = Math.max(4, Math.floor(w / counts.length) - 2);
      const bars = rows.map((r, i) => {
        const count = counts[i];
        const bh = Math.max(2, Math.round((count / maxVal) * (h - 20)));
        const x = Math.round((i / counts.length) * w);
        const y = h - bh;
        const day = new Date(r.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="2" fill="#58a6ff" opacity="0.85">
          <title>${esc(day)}: ${count} views</title>
        </rect>`;
      }).join('');
      // X-axis labels: show first, middle, last
      const labelIdxs = [0, Math.floor(rows.length / 2), rows.length - 1].filter((v, i, a) => a.indexOf(v) === i);
      const labels = labelIdxs.map(i => {
        const x = Math.round((i / counts.length) * w) + barW / 2;
        const day = new Date(rows[i].day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `<text x="${x}" y="${h + 4}" text-anchor="middle" font-size="10" fill="#8b949e">${esc(day)}</text>`;
      }).join('');
      return `<svg viewBox="0 0 ${w} ${h + 14}" style="width:100%;height:100px;">
        ${bars}${labels}
      </svg>`;
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
    .content { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .meta { color: #768390; margin-bottom: 24px; font-size: 14px; }
    .section-title { font-size: 16px; font-weight: 600; margin: 32px 0 16px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; font-size: 12px; }

    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 20px; }
    .stat-card .label { font-size: 12px; color: #768390; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
    .stat-card .value { font-size: 26px; font-weight: 700; }
    .stat-card .sub { font-size: 12px; color: #768390; margin-top: 4px; }

    .full-panel { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    .full-panel h2 { font-size: 15px; margin-bottom: 16px; border-bottom: 1px solid #21262d; padding-bottom: 8px; }

    .panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 16px; }
    .panel { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 20px; }
    .panel h2 { font-size: 15px; margin-bottom: 12px; border-bottom: 1px solid #21262d; padding-bottom: 8px; }
    .panel table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .panel table td { padding: 7px 8px; border-bottom: 1px solid #161b22; vertical-align: middle; }
    .panel table tr:last-child td { border-bottom: none; }

    .bar-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .bar-label { font-size: 13px; min-width: 120px; color: #8b949e; }
    .bar-track { flex: 1; height: 20px; background: #21262d; border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 4px; }
    .bar-count { font-size: 13px; min-width: 40px; text-align: right; font-weight: 600; }

    .nvr { display: flex; gap: 24px; margin-top: 8px; }
    .nvr-item { flex: 1; text-align: center; background: #0d1117; border-radius: 6px; padding: 12px; }
    .nvr-item .nvr-val { font-size: 22px; font-weight: 700; }
    .nvr-item .nvr-lbl { font-size: 12px; color: #768390; margin-top: 4px; }
  </style>
</head>
<body>
  ${buildNav('analytics', req.session)}
  <div class="content">
    <h1>Page Analytics</h1>
    <p class="meta">Public page traffic &mdash; ${now.toLocaleString('default', { month: 'long', year: 'numeric' })} &middot; excludes bots</p>

    <div class="section-title">Overview</div>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="label">Page Views</div>
        <div class="value">${totalViews.toLocaleString()}</div>
        <div class="sub">This month</div>
      </div>
      <div class="stat-card">
        <div class="label">Unique Visitors</div>
        <div class="value">${uniqueVisitors.toLocaleString()}</div>
        <div class="sub">Distinct fingerprints</div>
      </div>
      <div class="stat-card">
        <div class="label">Sessions</div>
        <div class="value">${uniqueSessions.toLocaleString()}</div>
        <div class="sub">30-min window</div>
      </div>
      <div class="stat-card">
        <div class="label">Bounce Rate</div>
        <div class="value" style="color:${bounceRate > 70 ? '#f85149' : bounceRate > 50 ? '#d29922' : '#3fb950'};">${bounceRate}%</div>
        <div class="sub">Single-page sessions</div>
      </div>
      <div class="stat-card">
        <div class="label">Pages / Session</div>
        <div class="value">${avgPagesPerSession.toFixed(1)}</div>
        <div class="sub">Avg depth</div>
      </div>
      <div class="stat-card">
        <div class="label">Top Source</div>
        <div class="value" style="font-size:16px;margin-top:4px;">${esc(topReferrer)}</div>
        <div class="sub">Most common referrer</div>
      </div>
    </div>

    <div class="section-title">Traffic Over Time</div>
    <div class="full-panel">
      <h2>Daily Views — ${now.toLocaleString('default', { month: 'long' })}</h2>
      ${dailySparkline(dailyViews.rows)}
    </div>

    <div class="section-title">Acquisition</div>
    <div class="panels">
      <div class="panel">
        <h2>Views by Page</h2>
        <table>${tableRows(viewsByPage.rows, r => r.path)}</table>
      </div>

      <div class="panel">
        <h2>Traffic Channels</h2>
        ${trafficChannels.length === 0
          ? '<div style="color:#768390;font-size:14px;">No data yet</div>'
          : barRows(trafficChannels, 'label')
        }
      </div>

      <div class="panel">
        <h2>Referrers <span style="font-size:12px;color:#768390;font-weight:normal;">(raw hostnames)</span></h2>
        <table>${tableRows(trafficSources.rows, r => r.referrer_host)}</table>
      </div>

      <div class="panel">
        <h2>UTM Campaigns</h2>
        <table>
          ${utmCampaigns.rows.length === 0
            ? '<tr><td colspan="2" style="color:#768390;">No UTM traffic yet</td></tr>'
            : utmCampaigns.rows.map(r => {
                const label = [r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).join(' / ');
                const count = parseInt(r.cnt, 10);
                return `<tr><td>${esc(label)}</td><td style="text-align:right;font-weight:600;">${count}</td></tr>`;
              }).join('')
          }
        </table>
      </div>

      <div class="panel">
        <h2>New vs Returning</h2>
        <div class="nvr">
          <div class="nvr-item">
            <div class="nvr-val" style="color:#3fb950;">${newVisitors.toLocaleString()}</div>
            <div class="nvr-lbl">New</div>
          </div>
          <div class="nvr-item">
            <div class="nvr-val" style="color:#58a6ff;">${returningVisitors.toLocaleString()}</div>
            <div class="nvr-lbl">Returning</div>
          </div>
        </div>
        ${newVisitors + returningVisitors > 0 ? `
        <div style="margin-top:16px;">
          <div style="height:8px;background:#21262d;border-radius:4px;overflow:hidden;display:flex;">
            <div style="width:${Math.round((newVisitors / (newVisitors + returningVisitors)) * 100)}%;background:#3fb950;"></div>
            <div style="flex:1;background:#58a6ff;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#768390;margin-top:4px;">
            <span>${Math.round((newVisitors / (newVisitors + returningVisitors)) * 100)}% new</span>
            <span>${Math.round((returningVisitors / (newVisitors + returningVisitors)) * 100)}% returning</span>
          </div>
        </div>` : ''}
      </div>
    </div>

    <div class="section-title">Audience</div>
    <div class="panels">
      <div class="panel">
        <h2>Countries</h2>
        ${countries.rows.length === 0
          ? '<div style="color:#768390;font-size:14px;">No geo data yet — populates for new visits in production</div>'
          : barRows(countries.rows.map(r => ({ ...r, country: countryLabel(r.country) })), 'country')
        }
      </div>

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

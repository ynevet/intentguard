const crypto = require('crypto');
const { pool } = require('./db');
const logger = require('./logger');

// ── Tracked public paths (allowlist) ─────────────────────────────────
const TRACKED_PATHS = new Set([
  '/', '/features', '/about', '/privacy', '/support',
  '/terms', '/sub-processors', '/slack/oauth/install',
]);

const OWN_DOMAINS = new Set(['intentify.tech', 'www.intentify.tech']);
const isProduction = process.env.NODE_ENV === 'production';

// ── User-Agent parsing (simple regex, zero deps) ─────────────────────

const BOT_RE = /bot|crawl|spider|slurp|wget|curl|fetch|headless|phantom|lighthouse|pingdom|uptimerobot|monitor/i;

function parseUserAgent(ua) {
  if (!ua) return { browser: 'Other', os: 'Other', deviceType: 'desktop' };

  if (BOT_RE.test(ua)) return { browser: 'Bot', os: 'Other', deviceType: 'bot' };

  // Browser
  let browser = 'Other';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  // OS
  let os = 'Other';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Macintosh|Mac OS/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Device type
  let deviceType = 'desktop';
  if (/Mobi|Android.*Mobile|iPhone|iPod/i.test(ua)) deviceType = 'mobile';
  else if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) deviceType = 'tablet';

  return { browser, os, deviceType };
}

// ── Extract page view data from request ──────────────────────────────

function extractPageViewData(req) {
  const ua = req.headers['user-agent'] || '';
  const { browser, os, deviceType } = parseUserAgent(ua);

  // Anonymous visitor fingerprint: SHA-256(ip_hash + user_agent)
  const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '0.0.0.0';
  const ipHash = crypto.createHash('sha256').update(rawIp).digest('hex');
  const visitorId = crypto.createHash('sha256').update(ipHash + ua).digest('hex');

  // Session cookie
  let sessionId = req.cookies?.ig_vid;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }

  // Referrer — only store external
  let referrer = null;
  let referrerHost = null;
  const rawReferrer = req.headers.referer || req.headers.referrer || '';
  if (rawReferrer) {
    try {
      const refUrl = new URL(rawReferrer);
      if (!OWN_DOMAINS.has(refUrl.hostname)) {
        referrer = rawReferrer.slice(0, 500);
        referrerHost = refUrl.hostname;
      }
    } catch { /* malformed referrer, ignore */ }
  }

  // UTM params
  const utmSource = req.query.utm_source || null;
  const utmMedium = req.query.utm_medium || null;
  const utmCampaign = req.query.utm_campaign || null;

  return {
    visitorId, ipHash, path: req.path,
    referrer, referrerHost,
    utmSource, utmMedium, utmCampaign,
    deviceType, browser, os,
    sessionId,
  };
}

// ── Save page view (fire-and-forget, matching saveLead pattern) ──────

async function savePageView(data) {
  try {
    await pool.query(
      `INSERT INTO page_views
        (visitor_id, ip_hash, path, referrer, referrer_host,
         utm_source, utm_medium, utm_campaign,
         device_type, browser, os, session_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        data.visitorId, data.ipHash, data.path,
        data.referrer, data.referrerHost,
        data.utmSource, data.utmMedium, data.utmCampaign,
        data.deviceType, data.browser, data.os, data.sessionId,
      ],
    );
  } catch (err) {
    logger.error({ err, path: data.path }, 'Failed to save page view');
  }
}

// ── Express middleware ────────────────────────────────────────────────

function trackPageView(req, res, next) {
  next();

  if (req.method !== 'GET') return;
  if (!TRACKED_PATHS.has(req.path)) return;

  const data = extractPageViewData(req);

  // Set/refresh session cookie (30 min rolling)
  res.cookie('ig_vid', data.sessionId, {
    maxAge: 30 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
  });

  savePageView(data);
}

// ── Retention cleanup (90 days) ──────────────────────────────────────

async function cleanupOldPageViews() {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM page_views WHERE created_at < now() - interval '90 days'",
    );
    if (rowCount > 0) {
      logger.info({ deletedCount: rowCount }, 'Cleaned up old page views');
    }
  } catch (err) {
    logger.error({ err }, 'Failed to cleanup old page views');
  }
}

module.exports = { trackPageView, cleanupOldPageViews, parseUserAgent };

const crypto = require('crypto');
const logger = require('./logger');

const COOKIE_NAME = 'ig_session';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Returns the signing secret for session cookies.
 * Prefers SLACK_CLIENT_SECRET (always available when OAuth is configured),
 * falls back to ADMIN_SECRET for local dev.
 */
function getSigningSecret() {
  return process.env.SLACK_CLIENT_SECRET || process.env.ADMIN_SECRET || null;
}

/**
 * Creates a signed session cookie value.
 * Format: base64(JSON) + '.' + hmac_sha256(base64(JSON), signingSecret)
 */
function createSession(payload) {
  const secret = getSigningSecret();
  if (!secret) return null;

  const data = { ...payload, exp: Date.now() + COOKIE_MAX_AGE };
  const b64 = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(b64).digest('hex');
  return `${b64}.${sig}`;
}

/**
 * Parses and verifies a signed session cookie value.
 * Returns the payload or null if invalid/expired.
 */
function parseSession(cookieValue) {
  if (!cookieValue || typeof cookieValue !== 'string') return null;

  const secret = getSigningSecret();
  if (!secret) return null;

  const dotIndex = cookieValue.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const b64 = cookieValue.slice(0, dotIndex);
  const sig = cookieValue.slice(dotIndex + 1);

  const expectedSig = crypto.createHmac('sha256', secret).update(b64).digest('hex');
  if (sig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expectedSig, 'utf8'))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Legacy: generates old-format session token from the admin secret (for migration).
 */
function generateSessionToken(adminSecret) {
  return crypto.createHmac('sha256', adminSecret).update('intentguard-session').digest('hex');
}

/**
 * Middleware: requires a valid session cookie on all admin routes.
 * Tries signed session first, falls back to legacy ADMIN_SECRET check.
 * Sets req.session and req.workspaceId on success.
 */
function requireAuth(req, res, next) {
  const adminSecret = process.env.ADMIN_SECRET;
  const slackClientId = process.env.SLACK_CLIENT_ID;

  // If neither auth method is configured, skip auth (local dev convenience)
  if (!adminSecret && !slackClientId) {
    req.workspaceId = 'default';
    req.session = null;
    return next();
  }

  const cookieValue = req.cookies?.[COOKIE_NAME];

  // Try new signed session format first
  const session = parseSession(cookieValue);
  if (session) {
    req.session = session;
    req.workspaceId = session.teamId || 'default';
    return next();
  }

  // Fall back to legacy ADMIN_SECRET token check
  if (adminSecret && cookieValue) {
    const expectedToken = generateSessionToken(adminSecret);
    if (cookieValue.length === expectedToken.length &&
        crypto.timingSafeEqual(Buffer.from(cookieValue, 'utf8'), Buffer.from(expectedToken, 'utf8'))) {
      req.session = { type: 'admin_secret' };
      req.workspaceId = 'default';
      return next();
    }
  }

  // Not authenticated
  return res.redirect('/admin/login');
}

/**
 * Validates the provided secret against ADMIN_SECRET.
 * On success, creates a new signed session (or falls back to legacy token).
 */
function validateLogin(secret) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || !secret) return { valid: false };

  const valid = secret.length === adminSecret.length
    && crypto.timingSafeEqual(Buffer.from(secret, 'utf8'), Buffer.from(adminSecret, 'utf8'));

  if (!valid) return { valid: false };

  // Create new-format signed session
  const sessionValue = createSession({ type: 'admin_secret', teamId: null });
  if (sessionValue) {
    return { valid: true, token: sessionValue };
  }

  // Fallback: legacy token (only if no signing secret available — shouldn't happen)
  return { valid: true, token: generateSessionToken(adminSecret) };
}

module.exports = { requireAuth, validateLogin, createSession, parseSession, COOKIE_NAME, COOKIE_MAX_AGE };

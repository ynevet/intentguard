const crypto = require('crypto');
const logger = require('./logger');

const COOKIE_NAME = 'ig_session';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generates a signed session token from the admin secret.
 * Uses HMAC so the cookie value isn't the raw secret.
 */
function generateSessionToken(adminSecret) {
  return crypto.createHmac('sha256', adminSecret).update('intentguard-session').digest('hex');
}

/**
 * Middleware: requires a valid session cookie on all admin routes.
 * Redirects to /admin/login if not authenticated.
 */
function requireAuth(req, res, next) {
  const adminSecret = process.env.ADMIN_SECRET;

  // If ADMIN_SECRET is not set, skip auth (local dev convenience)
  if (!adminSecret) {
    return next();
  }

  const sessionToken = req.cookies?.[COOKIE_NAME];
  const expectedToken = generateSessionToken(adminSecret);

  if (sessionToken && crypto.timingSafeEqual(
    Buffer.from(sessionToken, 'utf8'),
    Buffer.from(expectedToken, 'utf8'),
  )) {
    return next();
  }

  // Not authenticated — redirect to login
  return res.redirect('/admin/login');
}

/**
 * Validates the provided secret against ADMIN_SECRET.
 * Returns { valid, token } where token is the session cookie value.
 */
function validateLogin(secret) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || !secret) return { valid: false };

  const valid = secret.length === adminSecret.length
    && crypto.timingSafeEqual(Buffer.from(secret, 'utf8'), Buffer.from(adminSecret, 'utf8'));

  if (!valid) return { valid: false };

  return { valid: true, token: generateSessionToken(adminSecret) };
}

module.exports = { requireAuth, validateLogin, COOKIE_NAME, COOKIE_MAX_AGE };

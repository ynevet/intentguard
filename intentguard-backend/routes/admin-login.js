const crypto = require('crypto');
const express = require('express');
const logger = require('../lib/logger');
const { validateLogin, createSession, COOKIE_NAME, COOKIE_MAX_AGE } = require('../lib/auth');
const { getWorkspace } = require('../lib/db');
const { getSlackClient } = require('../lib/slack-client');

const loginRouter = express.Router();
const authRouter = express.Router();

// In-memory CSRF state store with 10-minute TTL (same pattern as slack-oauth.js)
const pendingStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [state, ts] of pendingStates) {
    if (now - ts > STATE_TTL_MS) pendingStates.delete(state);
  }
}, 5 * 60 * 1000);

/**
 * Derives the admin auth redirect URI from the existing SLACK_OAUTH_REDIRECT_URI.
 * Replaces the path with /admin/auth/callback.
 */
function getAdminRedirectUri() {
  const oauthUri = process.env.SLACK_OAUTH_REDIRECT_URI;
  if (!oauthUri) return '';
  try {
    const url = new URL(oauthUri);
    url.pathname = '/admin/auth/callback';
    return url.toString();
  } catch {
    return '';
  }
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function loginPage(error = '', installed = false) {
  const hasSlack = !!process.env.SLACK_CLIENT_ID;
  const hasSecret = !!process.env.ADMIN_SECRET;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IntentGuard — Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .login-card {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 48px 40px;
      max-width: 400px;
      width: 100%;
    }
    .login-card img { height: 48px; width: 48px; margin-bottom: 16px; }
    .login-card h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .login-card h1 span {
      background: linear-gradient(135deg, #58a6ff, #3fb950);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .login-card p {
      font-size: 14px;
      color: #8b949e;
      margin-bottom: 24px;
    }
    .slack-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 12px;
      background: #4A154B;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.2s;
    }
    .slack-btn:hover { background: #611f69; }
    .slack-btn svg { width: 20px; height: 20px; }
    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 20px 0;
      color: #484f58;
      font-size: 13px;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #21262d;
    }
    .form-group { margin-bottom: 16px; }
    .form-group label {
      display: block;
      font-size: 13px;
      color: #8b949e;
      margin-bottom: 6px;
    }
    .form-group input {
      width: 100%;
      padding: 10px 12px;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      color: #e6edf3;
      font-size: 14px;
    }
    .form-group input:focus {
      outline: none;
      border-color: #58a6ff;
      box-shadow: 0 0 0 3px rgba(88,166,255,0.2);
    }
    .btn {
      width: 100%;
      padding: 10px;
      background: #238636;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn:hover { background: #2ea043; }
    .error {
      background: #da36331a;
      border: 1px solid #f8514933;
      color: #f85149;
      padding: 10px 12px;
      border-radius: 6px;
      font-size: 13px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="login-card">
    <img src="/public/logo.png" alt="IntentGuard">
    <h1><span>IntentGuard</span></h1>
    <p>${hasSlack ? 'Sign in with your Slack workspace to access the dashboard.' : 'Enter your admin secret to access the dashboard.'}</p>
    ${installed ? '<div style="background:#2ea043;color:#fff;padding:10px 12px;border-radius:6px;font-size:13px;margin-bottom:16px;">Workspace connected! Sign in to continue.</div>' : ''}
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
    ${hasSlack ? `<a class="slack-btn" href="/admin/auth/authorize">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 124 124" fill="none"><path d="M26.3996 78.2003C26.3996 85.3003 20.5996 91.1003 13.4996 91.1003C6.39961 91.1003 0.599609 85.3003 0.599609 78.2003C0.599609 71.1003 6.39961 65.3003 13.4996 65.3003H26.3996V78.2003Z" fill="#E01E5A"/><path d="M32.9004 78.2003C32.9004 71.1003 38.7004 65.3003 45.8004 65.3003C52.9004 65.3003 58.7004 71.1003 58.7004 78.2003V110.5C58.7004 117.6 52.9004 123.4 45.8004 123.4C38.7004 123.4 32.9004 117.6 32.9004 110.5V78.2003Z" fill="#E01E5A"/><path d="M45.8004 26.4001C38.7004 26.4001 32.9004 20.6001 32.9004 13.5001C32.9004 6.4001 38.7004 0.600098 45.8004 0.600098C52.9004 0.600098 58.7004 6.4001 58.7004 13.5001V26.4001H45.8004Z" fill="#36C5F0"/><path d="M45.7996 32.8999C52.8996 32.8999 58.6996 38.6999 58.6996 45.7999C58.6996 52.8999 52.8996 58.6999 45.7996 58.6999H13.4996C6.39961 58.6999 0.599609 52.8999 0.599609 45.7999C0.599609 38.6999 6.39961 32.8999 13.4996 32.8999H45.7996Z" fill="#36C5F0"/><path d="M97.5996 45.7999C97.5996 38.6999 103.4 32.8999 110.5 32.8999C117.6 32.8999 123.4 38.6999 123.4 45.7999C123.4 52.8999 117.6 58.6999 110.5 58.6999H97.5996V45.7999Z" fill="#2EB67D"/><path d="M91.0988 45.8001C91.0988 52.9001 85.2988 58.7001 78.1988 58.7001C71.0988 58.7001 65.2988 52.9001 65.2988 45.8001V13.5001C65.2988 6.4001 71.0988 0.600098 78.1988 0.600098C85.2988 0.600098 91.0988 6.4001 91.0988 13.5001V45.8001Z" fill="#2EB67D"/><path d="M78.1988 97.6001C85.2988 97.6001 91.0988 103.4 91.0988 110.5C91.0988 117.6 85.2988 123.4 78.1988 123.4C71.0988 123.4 65.2988 117.6 65.2988 110.5V97.6001H78.1988Z" fill="#ECB22E"/><path d="M78.1988 91.1003C71.0988 91.1003 65.2988 85.3003 65.2988 78.2003C65.2988 71.1003 71.0988 65.3003 78.1988 65.3003H110.499C117.599 65.3003 123.399 71.1003 123.399 78.2003C123.399 85.3003 117.599 91.1003 110.499 91.1003H78.1988Z" fill="#ECB22E"/></svg>
      Sign in with Slack
    </a>` : ''}
    ${hasSlack && hasSecret ? '<div class="divider">or</div>' : ''}
    ${hasSecret ? `<form method="POST" action="/admin/login">
      <div class="form-group">
        <label for="secret">Admin Secret</label>
        <input type="password" id="secret" name="secret" placeholder="Enter admin secret" required ${!hasSlack ? 'autofocus' : ''}>
      </div>
      <button type="submit" class="btn">Sign in with password</button>
    </form>` : ''}
  </div>
</body>
</html>`;
}

function errorPage(title, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IntentGuard — ${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 48px 40px;
      max-width: 440px;
      width: 100%;
      text-align: center;
    }
    .card h1 { font-size: 20px; margin-bottom: 12px; color: #f85149; }
    .card p { font-size: 14px; color: #8b949e; margin-bottom: 24px; }
    .card a {
      display: inline-block;
      padding: 10px 24px;
      background: #21262d;
      color: #e6edf3;
      border-radius: 6px;
      text-decoration: none;
      font-size: 14px;
    }
    .card a:hover { background: #30363d; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${message}</p>
    <a href="/admin/login">Back to login</a>
  </div>
</body>
</html>`;
}

// ── Login router (mounted at /admin/login) ──

// GET /admin/login — show login form
loginRouter.get('/', (req, res) => {
  if (!process.env.ADMIN_SECRET && !process.env.SLACK_CLIENT_ID) {
    return res.redirect('/admin/evaluations');
  }
  res.send(loginPage('', req.query.installed === '1'));
});

// POST /admin/login — validate secret and set cookie
loginRouter.post('/', express.urlencoded({ extended: false }), (req, res) => {
  const { secret } = req.body;
  const result = validateLogin(secret);

  if (!result.valid) {
    logger.warn({ ip: req.ip }, 'Failed admin login attempt');
    return res.status(401).send(loginPage('Invalid admin secret. Please try again.'));
  }

  res.cookie(COOKIE_NAME, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  logger.info({ ip: req.ip }, 'Admin login successful');
  res.redirect('/admin/evaluations');
});

// GET /admin/login/logout — clear cookie and redirect to login
loginRouter.get('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.redirect('/admin/login');
});

// ── Auth router (mounted at /admin/auth) ──

// GET /admin/auth/authorize — Redirect to Slack OpenID Connect
authRouter.get('/authorize', (req, res) => {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return res.status(500).send('SLACK_CLIENT_ID not configured');
  }

  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, Date.now());

  const redirectUri = getAdminRedirectUri();
  const nonce = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    response_type: 'code',
    scope: 'openid profile email',
    client_id: clientId,
    state,
    nonce,
    ...(redirectUri ? { redirect_uri: redirectUri } : {}),
  });

  res.redirect(`https://slack.com/openid/connect/authorize?${params}`);
});

// GET /admin/auth/callback — Handle Slack OpenID Connect callback
authRouter.get('/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    logger.warn({ oauthError }, 'Slack OpenID Connect denied by user');
    return res.send(errorPage('Sign-in cancelled', 'You cancelled the Slack sign-in. Please try again.'));
  }

  if (!state || !pendingStates.has(state)) {
    logger.warn('Slack OpenID callback with invalid or expired state');
    return res.send(errorPage('Invalid request', 'The sign-in link has expired. Please try again.'));
  }

  if (Date.now() - pendingStates.get(state) > STATE_TTL_MS) {
    pendingStates.delete(state);
    return res.send(errorPage('Session expired', 'The sign-in link has expired. Please try again.'));
  }

  pendingStates.delete(state);

  if (!code) {
    return res.send(errorPage('Missing code', 'Slack did not return an authorization code. Please try again.'));
  }

  try {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = getAdminRedirectUri();

    if (!clientId || !clientSecret) {
      throw new Error('SLACK_CLIENT_ID or SLACK_CLIENT_SECRET not configured');
    }

    // Exchange code for token via Slack OpenID Connect
    const tokenResponse = await fetch('https://slack.com/api/openid.connect.token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        ...(redirectUri ? { redirect_uri: redirectUri } : {}),
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.ok) {
      logger.error({ error: tokenData.error }, 'Slack OpenID token exchange failed');
      throw new Error(`Token exchange failed: ${tokenData.error}`);
    }

    // Fetch user info
    const userInfoResponse = await fetch('https://slack.com/api/openid.connect.userInfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userInfo = await userInfoResponse.json();
    if (!userInfo.ok) {
      logger.error({ error: userInfo.error }, 'Slack OpenID userInfo failed');
      throw new Error(`UserInfo failed: ${userInfo.error}`);
    }

    const userId = userInfo.sub;
    const teamId = userInfo['https://slack.com/team_id'];
    const teamName = userInfo['https://slack.com/team_name'];
    const displayName = userInfo.name || userInfo.given_name || 'User';

    if (!teamId || !userId) {
      throw new Error('Missing team_id or user_id from Slack');
    }

    // Check workspace exists in our DB (must have installed IntentGuard)
    const workspace = await getWorkspace(teamId);
    if (!workspace) {
      logger.warn({ teamId, userId }, 'Sign-in attempt from workspace without IntentGuard');
      return res.send(errorPage(
        'Workspace not found',
        'Your workspace hasn\'t installed IntentGuard yet. Ask a workspace admin to <a href="/slack/oauth/install" style="color:#58a6ff;">install it first</a>.',
      ));
    }

    // Check if user is a workspace admin/owner using bot token
    const client = await getSlackClient(teamId);
    if (!client) {
      throw new Error('No bot client available for workspace');
    }

    const userInfoResult = await client.users.info({ user: userId });
    const isAdmin = userInfoResult.user?.is_admin || userInfoResult.user?.is_owner;

    if (!isAdmin) {
      logger.warn({ teamId, userId, displayName }, 'Non-admin sign-in attempt');
      return res.send(errorPage(
        'Access denied',
        'Only workspace admins and owners can access the IntentGuard dashboard. Contact your workspace admin for access.',
      ));
    }

    // Create signed session
    const sessionValue = createSession({
      type: 'slack',
      userId,
      teamId,
      teamName,
      displayName,
      isAdmin: true,
    });

    if (!sessionValue) {
      throw new Error('Failed to create session');
    }

    res.cookie(COOKIE_NAME, sessionValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    logger.info({ teamId, teamName, userId, displayName }, 'Slack admin sign-in successful');
    res.redirect('/admin/evaluations');
  } catch (err) {
    logger.error({ err }, 'Slack OpenID Connect callback failed');
    return res.send(errorPage(
      'Sign-in failed',
      'Something went wrong during Slack sign-in. Please try again.',
    ));
  }
});

module.exports = { loginRouter, authRouter };

const crypto = require('crypto');
const express = require('express');
const { WebClient } = require('@slack/web-api');
const logger = require('../lib/logger');
const { upsertWorkspace, seedWorkspaceSettings } = require('../lib/db');
const { invalidateClientCache, getSlackClient } = require('../lib/slack-client');
const { createSession, COOKIE_NAME, COOKIE_MAX_AGE } = require('../lib/auth');
const { buildNav } = require('../lib/nav');

const router = express.Router();

// In-memory CSRF state store with 10-minute TTL
const pendingStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

// Cleanup expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, ts] of pendingStates) {
    if (now - ts > STATE_TTL_MS) pendingStates.delete(state);
  }
}, 5 * 60 * 1000);

const BOT_SCOPES = [
  'channels:read',
  'channels:join',
  'chat:write',
  'reactions:write',
  'files:read',
  'files:write',
  'im:write',
  'users:read',
].join(',');

const USER_SCOPES = 'files:write';

router.get('/authorize', (req, res) => {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return res.status(500).send('SLACK_CLIENT_ID not configured');
  }

  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, Date.now());

  const redirectUri = process.env.SLACK_OAUTH_REDIRECT_URI || '';
  const params = new URLSearchParams({
    client_id: clientId,
    scope: BOT_SCOPES,
    user_scope: USER_SCOPES,
    state,
    ...(redirectUri ? { redirect_uri: redirectUri } : {}),
  });

  res.redirect(`https://slack.com/oauth/v2/authorize?${params}`);
});

router.get('/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    logger.warn({ oauthError }, 'Slack OAuth denied by user');
    return res.redirect('/slack/oauth/install?error=oauth_denied');
  }

  if (!state || !pendingStates.has(state)) {
    logger.warn('Slack OAuth callback with invalid or expired state');
    return res.redirect('/slack/oauth/install?error=invalid_state');
  }

  // Check TTL
  if (Date.now() - pendingStates.get(state) > STATE_TTL_MS) {
    pendingStates.delete(state);
    return res.redirect('/slack/oauth/install?error=expired_state');
  }

  pendingStates.delete(state);

  if (!code) {
    return res.redirect('/slack/oauth/install?error=missing_code');
  }

  try {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_OAUTH_REDIRECT_URI || undefined;

    if (!clientId || !clientSecret) {
      throw new Error('SLACK_CLIENT_ID or SLACK_CLIENT_SECRET not configured');
    }

    // Exchange code for tokens using @slack/web-api (no new deps needed)
    const webClient = new WebClient();
    const result = await webClient.oauth.v2.access({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    });

    const teamId = result.team?.id;
    const teamName = result.team?.name;
    const botToken = result.access_token;
    const botUserId = result.bot_user_id;
    const userToken = result.authed_user?.access_token || null;

    if (!teamId || !botToken) {
      throw new Error('OAuth response missing team_id or access_token');
    }

    // Persist workspace + tokens
    await upsertWorkspace({
      id: teamId,
      name: teamName || teamId,
      platform: 'slack',
      status: 'active',
      botToken,
      userToken,
      botUserId,
      teamName,
    });

    // Seed default settings for new workspace
    await seedWorkspaceSettings(teamId);

    // Clear cached clients so new tokens take effect
    invalidateClientCache(teamId);

    logger.info({ teamId, teamName, botUserId }, 'Slack workspace installed via OAuth');

    // Auto-sign-in: the installing user is almost certainly a workspace admin
    const authedUserId = result.authed_user?.id;
    if (authedUserId) {
      try {
        const client = await getSlackClient(teamId);
        const userInfoResult = await client.users.info({ user: authedUserId });
        const isAdmin = userInfoResult.user?.is_admin || userInfoResult.user?.is_owner;

        if (isAdmin) {
          const displayName = userInfoResult.user?.real_name || userInfoResult.user?.name || 'Admin';
          const sessionValue = createSession({
            type: 'slack',
            userId: authedUserId,
            teamId,
            teamName,
            displayName,
            isAdmin: true,
          });

          if (sessionValue) {
            res.cookie(COOKIE_NAME, sessionValue, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: COOKIE_MAX_AGE,
              path: '/',
            });
            logger.info({ teamId, authedUserId, displayName }, 'Auto-signed in installing admin');
            return res.redirect('/admin/integrations/slack?installed=1');
          }
        }
      } catch (signInErr) {
        logger.warn({ err: signInErr, teamId, authedUserId }, 'Auto-sign-in after install failed, falling back to login');
      }
    }

    // Fallback: redirect to login if auto-sign-in didn't work
    res.redirect('/admin/login?installed=1');
  } catch (err) {
    logger.error({ err }, 'Slack OAuth callback failed');
    res.redirect('/slack/oauth/install?error=oauth_failed');
  }
});

const ERROR_MESSAGES = {
  oauth_denied: 'You cancelled the Slack authorization. Please try again.',
  invalid_state: 'The install link was invalid or expired. Please try again.',
  expired_state: 'The install link has expired. Please try again.',
  missing_code: 'Slack did not return an authorization code. Please try again.',
  oauth_failed: 'Something went wrong during installation. Please try again.',
};

router.get('/install', (req, res) => {
  const clientId = process.env.SLACK_CLIENT_ID;
  const configured = !!clientId;
  const errorCode = req.query.error || '';
  const errorMsg = ERROR_MESSAGES[errorCode] || '';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IntentGuard — Add to Slack</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #e6edf3; }
    .content { max-width: 520px; margin: 0 auto; padding: 80px 24px; text-align: center; }
    h1 { font-size: 28px; margin-bottom: 12px; }
    .subtitle { color: #8b949e; font-size: 16px; margin-bottom: 40px; }
    .error-toast { background: #da3633; color: #fff; padding: 10px 16px; border-radius: 6px; font-size: 14px; margin-bottom: 24px; display: inline-block; }
    .install-btn {
      display: inline-block;
      padding: 14px 32px;
      background: #1f6feb;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      border-radius: 8px;
      text-decoration: none;
      transition: background 0.2s;
    }
    .install-btn:hover { background: #388bfd; }
    .not-configured {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 8px;
      padding: 24px;
      color: #8b949e;
      font-size: 14px;
    }
    .not-configured code { background: #0d1117; border: 1px solid #21262d; border-radius: 4px; padding: 2px 8px; font-size: 13px; }
  </style>
</head>
<body>
  ${buildNav('')}
  <div class="content">
    <h1>Add IntentGuard to Slack</h1>
    <p class="subtitle">AI-powered DLP that catches attachments that don't match what users say they are.</p>
    ${errorMsg ? `<div class="error-toast">${errorMsg}</div><br>` : ''}
    ${configured
      ? '<a class="install-btn" href="/slack/oauth/authorize">Add to Slack</a>'
      : '<div class="not-configured"><p>OAuth is not configured. Set <code>SLACK_CLIENT_ID</code>, <code>SLACK_CLIENT_SECRET</code>, and optionally <code>SLACK_OAUTH_REDIRECT_URI</code> to enable the install flow.</p></div>'
    }
  </div>
</body>
</html>`);
});

module.exports = router;

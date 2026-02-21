const express = require('express');
const { getSetting, setSetting, getAllActiveWorkspaces } = require('../lib/db');
const { buildNav } = require('../lib/nav');
const logger = require('../lib/logger');

const router = express.Router();

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

router.get('/', async (req, res) => {
  try {
    const saved = req.query.saved === '1';
    const installed = req.query.installed === '1';
    const oauthError = req.query.error || '';

    // Workspace status from DB
    const workspaces = await getAllActiveWorkspaces();
    const slackWorkspaces = workspaces.filter((ws) => ws.platform === 'slack' && ws.bot_token);
    const hasEnvToken = !!process.env.SLACK_BOT_TOKEN;
    const hasOAuth = !!process.env.SLACK_CLIENT_ID;
    const monitoredChannels = await getSetting('slack.monitored_channels') || '';
    const excludedChannels = await getSetting('slack.excluded_channels') || '';
    const warningThreshold = await getSetting('slack.warning_threshold') || '50';
    const dmThreshold = await getSetting('slack.delete_threshold') || '70';
    const strictAudienceBlocking = (await getSetting('slack.strict_audience_blocking') || 'false') === 'true';
    const autoJoinChannels = (await getSetting('slack.auto_join_channels') || 'true') === 'true';

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IntentGuard — Slack Integration</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #e6edf3; }
    .content { max-width: 720px; margin: 0 auto; padding: 32px 24px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .meta { color: #768390; margin-bottom: 24px; font-size: 14px; }
    .breadcrumb { font-size: 13px; color: #768390; margin-bottom: 16px; }
    .breadcrumb a { color: #58a6ff; text-decoration: none; }
    .settings { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
    .settings h2 { font-size: 15px; margin-bottom: 16px; color: #e6edf3; border-bottom: 1px solid #21262d; padding-bottom: 8px; }
    .field { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    .field:last-of-type { margin-bottom: 16px; }
    label { font-size: 14px; color: #e6edf3; min-width: 200px; }
    input[type="number"] { width: 70px; padding: 6px 8px; border-radius: 4px; border: 1px solid #30363d; background: #0d1117; color: #e6edf3; font-size: 14px; }
    input[type="text"] { width: 340px; padding: 6px 8px; border-radius: 4px; border: 1px solid #30363d; background: #0d1117; color: #e6edf3; font-size: 14px; }
    button { padding: 6px 16px; border-radius: 4px; border: none; background: #1f6feb; color: #fff; font-size: 14px; cursor: pointer; }
    button:hover { background: #388bfd; }
    .hint { font-size: 12px; color: #768390; }
    input[type="checkbox"] { width: 18px; height: 18px; accent-color: #1f6feb; }
    .toast { background: #2ea043; color: #fff; padding: 8px 16px; border-radius: 4px; font-size: 14px; display: inline-block; margin-bottom: 16px; }
    .info-card { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 24px; }
    .info-card h3 { font-size: 15px; margin-bottom: 12px; }
    .info-card p { font-size: 14px; color: #8b949e; margin-bottom: 8px; }
    .info-card code { background: #0d1117; border: 1px solid #21262d; border-radius: 4px; padding: 2px 8px; font-size: 13px; color: #8b949e; }
  </style>
</head>
<body>
  ${buildNav('integrations-slack')}
  <div class="content">
    <div class="breadcrumb"><a href="/admin/integrations">Integrations</a> / Slack</div>
    <h1>Slack Integration</h1>
    <p class="meta">Configure how IntentGuard monitors and responds in your Slack workspace.</p>

    ${saved ? '<div class="toast">Slack settings saved</div>' : ''}
    ${installed ? '<div class="toast">Workspace connected successfully!</div>' : ''}
    ${oauthError ? `<div class="toast" style="background:#da3633;">OAuth error: ${escapeHtml(oauthError)}</div>` : ''}

    <form class="settings" method="POST" action="/admin/integrations/slack">
      <h2>Channel Monitoring</h2>
      <div class="field">
        <label for="monitored_channels">Monitored channels</label>
        <input type="text" id="monitored_channels" name="monitored_channels" value="${escapeHtml(monitoredChannels)}" placeholder="All channels">
        <span class="hint">Comma-separated channel IDs (e.g. C0ABC123,C0DEF456). Empty = all channels.</span>
      </div>
      <div class="field">
        <label for="excluded_channels">Excluded channels</label>
        <input type="text" id="excluded_channels" name="excluded_channels" value="${escapeHtml(excludedChannels)}" placeholder="None">
        <span class="hint">Comma-separated channel IDs to skip scanning (e.g. C0RANDOM,C0MEMES). Takes priority over monitored list.</span>
      </div>
      <div class="field">
        <label for="auto_join_channels">Auto-join public channels</label>
        <input type="checkbox" id="auto_join_channels" name="auto_join_channels" ${autoJoinChannels ? 'checked' : ''}>
        <span class="hint">Automatically join all public channels on startup and when new channels are created. Excluded channels are skipped.</span>
      </div>

      <h2>Alert Thresholds</h2>
      <div class="field">
        <label for="warning_threshold">Thread warning threshold</label>
        <input type="number" id="warning_threshold" name="warning_threshold" min="0" max="100" value="${escapeHtml(warningThreshold)}">
        <span class="hint">% — Below this, mismatches get only an emoji reaction.</span>
      </div>
      <div class="field">
        <label for="delete_threshold">DM notification threshold</label>
        <input type="number" id="delete_threshold" name="delete_threshold" min="0" max="100" value="${escapeHtml(dmThreshold)}">
        <span class="hint">% — At or above this, the user also receives a direct message.</span>
      </div>

      <h2>Audience Protection</h2>
      <div class="field">
        <label for="strict_audience_blocking">Strict audience blocking</label>
        <input type="checkbox" id="strict_audience_blocking" name="strict_audience_blocking" ${strictAudienceBlocking ? 'checked' : ''}>
        <span class="hint">When on, sensitive files (financials, PII, etc.) are blocked in public channels even if the description matches. When off, only mismatched intent or external channels trigger blocking.</span>
      </div>

      <button type="submit">Save Slack Settings</button>
    </form>

    <div class="info-card">
      <h3>Connected Workspaces</h3>
      ${slackWorkspaces.length > 0
        ? slackWorkspaces.map((ws) => `<p><strong>${escapeHtml(ws.team_name || ws.name)}</strong> <code>${escapeHtml(ws.id)}</code>${ws.installed_at ? ` &mdash; installed ${new Date(ws.installed_at).toLocaleDateString()}` : ''}</p>`).join('\n      ')
        : ''}
      ${hasEnvToken ? '<p><strong>Default Workspace</strong> <code>env var</code> &mdash; configured via SLACK_BOT_TOKEN</p>' : ''}
      ${!hasEnvToken && slackWorkspaces.length === 0 ? '<p style="color:#8b949e;">No workspaces connected. Install via OAuth or set SLACK_BOT_TOKEN.</p>' : ''}
      ${hasOAuth ? '<p style="margin-top:12px;"><a href="/slack/oauth/install" style="color:#58a6ff;">+ Add another workspace</a></p>' : ''}
    </div>

    <div class="info-card" style="margin-top:16px;">
      <h3>About This Integration</h3>
      <p>IntentGuard monitors file attachments shared in your Slack workspace and verifies that file content matches the sender's stated intent using AI-powered three-axis analysis.</p>
      <p>Webhook endpoint: <code>POST /slack/events</code></p>
    </div>
  </div>
</body>
</html>`);
  } catch (err) {
    logger.error({ err }, 'Failed to load Slack integration settings');
    res.status(500).send('Internal server error');
  }
});

router.post('/', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const monitoredChannels = (req.body.monitored_channels || '').trim();
    await setSetting('slack.monitored_channels', monitoredChannels);

    const excludedChannels = (req.body.excluded_channels || '').trim();
    await setSetting('slack.excluded_channels', excludedChannels);

    const warningThreshold = parseInt(req.body.warning_threshold, 10);
    if (Number.isNaN(warningThreshold) || warningThreshold < 0 || warningThreshold > 100) {
      return res.status(400).send('Warning threshold must be between 0 and 100');
    }
    await setSetting('slack.warning_threshold', String(warningThreshold));

    const dmThreshold = parseInt(req.body.delete_threshold, 10);
    if (Number.isNaN(dmThreshold) || dmThreshold < 0 || dmThreshold > 100) {
      return res.status(400).send('DM threshold must be between 0 and 100');
    }
    await setSetting('slack.delete_threshold', String(dmThreshold));

    const strictAudienceBlocking = req.body.strict_audience_blocking === 'on' ? 'true' : 'false';
    await setSetting('slack.strict_audience_blocking', strictAudienceBlocking);

    const autoJoinChannels = req.body.auto_join_channels === 'on' ? 'true' : 'false';
    await setSetting('slack.auto_join_channels', autoJoinChannels);

    logger.info({ monitoredChannels, excludedChannels, warningThreshold, dmThreshold, strictAudienceBlocking, autoJoinChannels }, 'Slack integration settings updated');
    res.redirect('/admin/integrations/slack?saved=1');
  } catch (err) {
    logger.error({ err }, 'Failed to save Slack integration settings');
    res.status(500).send('Failed to save settings');
  }
});

module.exports = router;

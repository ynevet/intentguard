const express = require('express');
const { buildNav } = require('../lib/nav');

const router = express.Router();

router.get('/', (req, res) => {
  const slackConfigured = !!process.env.SLACK_BOT_TOKEN;
  const slackStatus = slackConfigured ? 'Active' : 'Not configured';
  const slackBadgeColor = slackConfigured ? '#2ea043' : '#768390';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IntentGuard — Integrations</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #e6edf3; }
    .content { max-width: 720px; margin: 0 auto; padding: 32px 24px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .meta { color: #768390; margin-bottom: 24px; font-size: 14px; }
    .integrations-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .integration-card {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 24px;
      text-decoration: none;
      color: #e6edf3;
      transition: border-color 0.2s, transform 0.2s;
      display: block;
    }
    .integration-card:hover { border-color: #388bfd; transform: translateY(-2px); }
    .integration-card .header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .integration-card .icon { font-size: 28px; }
    .integration-card h2 { font-size: 18px; }
    .integration-card p { font-size: 14px; color: #8b949e; margin-bottom: 12px; }
    .status-badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 10px;
      border-radius: 4px;
      color: #fff;
    }
    .coming-soon {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 24px;
      opacity: 0.5;
    }
    .coming-soon .header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .coming-soon .icon { font-size: 28px; }
    .coming-soon h2 { font-size: 18px; color: #8b949e; }
    .coming-soon p { font-size: 14px; color: #484f58; }
  </style>
</head>
<body>
  ${buildNav('integrations')}
  <div class="content">
    <h1>Integrations</h1>
    <p class="meta">Manage platform-specific settings for each connected integration.</p>
    <div class="integrations-grid">
      <a class="integration-card" href="/admin/integrations/slack">
        <div class="header">
          <span class="icon">&#x1F4AC;</span>
          <h2>Slack</h2>
        </div>
        <p>Channel monitoring, alert thresholds, and DM notification settings for your Slack workspace.</p>
        <span class="status-badge" style="background:${slackBadgeColor};">${slackStatus}</span>
      </a>

      <div class="coming-soon">
        <div class="header">
          <span class="icon">&#x1F4BC;</span>
          <h2>Microsoft Teams</h2>
        </div>
        <p>Coming soon — three-axis verification for Teams channels and chats.</p>
      </div>

      <div class="coming-soon">
        <div class="header">
          <span class="icon">&#x1F4E7;</span>
          <h2>Email (SMTP)</h2>
        </div>
        <p>Coming soon — scan email attachments before they leave your organization.</p>
      </div>
    </div>
  </div>
</body>
</html>`);
});

module.exports = router;

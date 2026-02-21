require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('./lib/logger');
const { initDb, runRetentionCleanup, cleanupExpiredResendContexts, getAllActiveWorkspaces } = require('./lib/db');
const { buildNav } = require('./lib/nav');
const { requireAuth } = require('./lib/auth');
const slackRouter = require('./routes/slack');
const slackOAuthRouter = require('./routes/slack-oauth');
const adminRouter = require('./routes/admin');
const { loginRouter: adminLoginRouter, authRouter: adminAuthRouter } = require('./routes/admin-login');
const featuresRouter = require('./routes/features');
const integrationsRouter = require('./routes/admin-integrations');
const integrationsSlackRouter = require('./routes/admin-integrations-slack');
const statsRouter = require('./routes/admin-stats');
const { rollupMonthlySummary } = require('./lib/rollup');
const { joinAllPublicChannels } = require('./lib/channel-join');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Cookie parser — needed for auth session cookies
app.use(cookieParser());

app.use('/public', express.static(path.join(__dirname, 'public')));

// Public routes (no auth)
app.use('/slack/oauth', slackOAuthRouter);
app.use('/slack', slackRouter);
app.use('/admin/login', adminLoginRouter);
app.use('/admin/auth', adminAuthRouter);

// Protected routes (require auth)
app.use('/admin/integrations/slack', requireAuth, integrationsSlackRouter);
app.use('/admin/integrations', requireAuth, integrationsRouter);
app.use('/admin/stats', requireAuth, statsRouter);
app.use('/admin', requireAuth, adminRouter);
app.use('/features', requireAuth, featuresRouter);

app.get('/', requireAuth, (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IntentGuard — AI-Powered DLP</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      line-height: 1.6;
    }
    .hero {
      text-align: center;
      padding: 100px 24px 60px;
      background: linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%);
    }
    .hero img { height: 80px; width: 80px; margin-bottom: 24px; }
    .hero h1 { font-size: 48px; font-weight: 700; margin-bottom: 16px; }
    .hero h1 span {
      background: linear-gradient(135deg, #58a6ff, #3fb950);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero .tagline {
      font-size: 20px;
      color: #8b949e;
      max-width: 600px;
      margin: 0 auto 48px;
    }
    .nav-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
      max-width: 900px;
      margin: 0 auto;
    }
    .nav-card {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 28px 24px;
      text-decoration: none;
      color: #e6edf3;
      transition: border-color 0.2s, transform 0.2s;
    }
    .nav-card:hover {
      border-color: #388bfd;
      transform: translateY(-2px);
    }
    .nav-card .icon { font-size: 32px; margin-bottom: 12px; }
    .nav-card h2 { font-size: 18px; margin-bottom: 8px; }
    .nav-card p { font-size: 14px; color: #8b949e; }
    .footer {
      text-align: center;
      padding: 40px 24px;
      font-size: 13px;
      color: #484f58;
    }
  </style>
</head>
<body>
  ${buildNav('home', req.session)}
  <div class="hero">
    <img src="/public/logo.png" alt="IntentGuard logo">
    <h1><span>IntentGuard</span></h1>
    <p class="tagline">AI-powered DLP that catches the #1 blindspot: attachments that don't match what users say they are.</p>
    <div class="nav-cards">
      <a class="nav-card" href="/features">
        <div class="icon">&#x1F680;</div>
        <h2>Product Features</h2>
        <p>Three-axis verification, recipient-aware scanning, tiered alerts, and zero content retention.</p>
      </a>
      <a class="nav-card" href="/admin/evaluations">
        <div class="icon">&#x1F4CA;</div>
        <h2>Evaluations</h2>
        <p>Audit trail of all file verification results, global settings, and risk summaries.</p>
      </a>
      <a class="nav-card" href="/admin/stats">
        <div class="icon">&#x1F4C8;</div>
        <h2>Stats &amp; Analytics</h2>
        <p>Detection breakdown, cost savings, risk trends, and top risky channels/users.</p>
      </a>
      <a class="nav-card" href="/admin/integrations">
        <div class="icon">&#x1F517;</div>
        <h2>Integrations</h2>
        <p>Manage platform-specific settings for Slack, and soon Teams and Email.</p>
      </a>
    </div>
  </div>
  <div class="footer">IntentGuard &mdash; AI-powered Data Loss Prevention for modern teams</div>
</body>
</html>`);
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
    });

    // Helper: run a per-workspace job across all active workspaces
    async function forEachWorkspace(jobName, fn) {
      try {
        const workspaces = await getAllActiveWorkspaces();
        for (const ws of workspaces) {
          try {
            await fn(ws.id);
          } catch (err) {
            logger.error({ err, workspaceId: ws.id }, `${jobName} failed for workspace`);
          }
        }
      } catch (err) {
        logger.error({ err }, `${jobName} failed to list workspaces`);
      }
    }

    // Run retention cleanup on startup, then every 6 hours
    forEachWorkspace('Retention cleanup', runRetentionCleanup);
    setInterval(() => {
      forEachWorkspace('Retention cleanup', runRetentionCleanup);
    }, 6 * 60 * 60 * 1000);

    // Run monthly rollup on startup, then every 6 hours
    forEachWorkspace('Monthly rollup', rollupMonthlySummary);
    setInterval(() => {
      forEachWorkspace('Monthly rollup', rollupMonthlySummary);
    }, 6 * 60 * 60 * 1000);

    // Cleanup expired resend contexts on startup, then every 30 minutes (global, not per-workspace)
    cleanupExpiredResendContexts().catch((err) => logger.error({ err }, 'Resend context cleanup failed'));
    setInterval(() => {
      cleanupExpiredResendContexts().catch((err) => logger.error({ err }, 'Resend context cleanup failed'));
    }, 30 * 60 * 1000);

    // Auto-join all public Slack channels on startup, then every 5 minutes
    forEachWorkspace('Auto-join channels', joinAllPublicChannels);
    setInterval(() => {
      forEachWorkspace('Auto-join channels', joinAllPublicChannels);
    }, 5 * 60 * 1000);

    // Keep Supabase free-tier project alive (pauses after 7 days of inactivity)
    setInterval(async () => {
      try {
        const { pool } = require('./lib/db');
        await pool.query('SELECT 1');
        logger.info('Supabase keep-alive ping');
      } catch (err) {
        logger.error({ err }, 'Supabase keep-alive ping failed');
      }
    }, 6 * 60 * 60 * 1000);
  })
  .catch((err) => {
    logger.fatal({ err }, 'Failed to initialize database — exiting');
    process.exit(1);
  });

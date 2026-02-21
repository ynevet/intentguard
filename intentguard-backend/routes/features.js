const express = require('express');
const { buildNav } = require('../lib/nav');
const router = express.Router();

router.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IntentGuard — Prevent Data Leaks Before They Happen</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      line-height: 1.6;
    }

    /* Hero */
    .hero {
      text-align: center;
      padding: 80px 24px 60px;
      background: linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%);
      border-bottom: 1px solid #21262d;
    }
    .hero img { height: 72px; width: 72px; margin-bottom: 20px; }
    .hero h1 { font-size: 42px; font-weight: 700; margin-bottom: 12px; }
    .hero h1 span { background: linear-gradient(135deg, #58a6ff, #3fb950); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .hero .tagline { font-size: 20px; color: #8b949e; max-width: 640px; margin: 0 auto 32px; }
    .hero .stat { display: inline-block; background: rgba(218,54,51,0.15); border: 1px solid rgba(218,54,51,0.3); border-radius: 8px; padding: 8px 20px; font-size: 15px; color: #f85149; margin-bottom: 24px; }

    /* Section */
    .section { max-width: 960px; margin: 0 auto; padding: 60px 24px; }
    .section h2 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .section .subtitle { font-size: 16px; color: #8b949e; margin-bottom: 40px; }

    /* How it works */
    .axes {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .axis {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 28px 24px;
    }
    .axis .icon { font-size: 32px; margin-bottom: 12px; }
    .axis h3 { font-size: 18px; margin-bottom: 8px; color: #e6edf3; }
    .axis p { font-size: 14px; color: #8b949e; }

    /* Features grid */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
    }
    .feature-card {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 28px 24px;
      transition: border-color 0.2s;
    }
    .feature-card:hover { border-color: #388bfd; }
    .feature-card .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 3px 10px;
      border-radius: 4px;
      margin-bottom: 12px;
    }
    .badge-core { background: rgba(56,139,253,0.15); color: #58a6ff; }
    .badge-new { background: rgba(63,185,80,0.15); color: #3fb950; }
    .badge-admin { background: rgba(210,153,34,0.15); color: #d29922; }
    .badge-security { background: rgba(218,54,51,0.15); color: #f85149; }
    .feature-card h3 { font-size: 17px; margin-bottom: 8px; color: #e6edf3; }
    .feature-card p { font-size: 14px; color: #8b949e; }

    /* Scenario section */
    .scenarios {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
    }
    .scenario {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 24px;
    }
    .scenario .label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .scenario .label.caught { color: #f85149; }
    .scenario .label.safe { color: #3fb950; }
    .scenario .says { font-size: 14px; color: #8b949e; margin-bottom: 4px; }
    .scenario .says strong { color: #e6edf3; }
    .scenario .actual { font-size: 14px; color: #e6edf3; }
    .scenario .arrow { color: #484f58; margin: 0 4px; }

    /* CTA */
    .cta {
      text-align: center;
      padding: 60px 24px 80px;
      border-top: 1px solid #21262d;
    }
    .cta h2 { font-size: 28px; margin-bottom: 12px; }
    .cta p { font-size: 16px; color: #8b949e; margin-bottom: 28px; }
    .cta .buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .cta a {
      display: inline-block;
      padding: 12px 28px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-primary { background: #1f6feb; color: #fff; }
    .btn-primary:hover { background: #388bfd; }
    .btn-secondary { background: #21262d; color: #e6edf3; border: 1px solid #30363d; }
    .btn-secondary:hover { background: #30363d; }

    /* Footer */
    .footer { text-align: center; padding: 24px; font-size: 13px; color: #484f58; border-top: 1px solid #21262d; }
  </style>
</head>
<body>

  ${buildNav('features', req.session)}

  <!-- Hero -->
  <div class="hero">
    <img src="/public/logo.png" alt="IntentGuard logo">
    <h1><span>IntentGuard</span></h1>
    <div class="stat">80% of insider data breaches start with a mis-send</div>
    <p class="tagline">AI-powered DLP that catches the #1 blindspot traditional tools miss: attachments that don't match what users say they are.</p>
  </div>

  <!-- How it works -->
  <div class="section">
    <h2>Three-Axis Verification</h2>
    <p class="subtitle">Every file shared is verified across three dimensions in real time.</p>
    <div class="axes">
      <div class="axis">
        <div class="icon">&#x1F4AC;</div>
        <h3>Intent</h3>
        <p>What the user <em>says</em> the file is. We parse the message text to understand the sender's stated purpose.</p>
      </div>
      <div class="axis">
        <div class="icon">&#x1F50D;</div>
        <h3>Content</h3>
        <p>What's <em>actually inside</em> the file. AI vision analyzes images; metadata analysis handles documents, spreadsheets, and more.</p>
      </div>
      <div class="axis">
        <div class="icon">&#x1F310;</div>
        <h3>Context</h3>
        <p>Whether the content is <em>appropriate for the audience</em>. Channel type, membership, external guests, and channel purpose are all factored in.</p>
      </div>
    </div>
  </div>

  <!-- Real-world scenarios -->
  <div class="section">
    <h2>What IntentGuard Catches</h2>
    <p class="subtitle">Real-world scenarios where traditional DLP is blind.</p>
    <div class="scenarios">
      <div class="scenario">
        <div class="label caught">Mismatch caught</div>
        <div class="says">User says: <strong>"Demo slides attached"</strong></div>
        <div class="actual"><span class="arrow">&rarr;</span> File contains Q1 financial results</div>
      </div>
      <div class="scenario">
        <div class="label caught">Mismatch caught</div>
        <div class="says">User says: <strong>"Anonymized report"</strong></div>
        <div class="actual"><span class="arrow">&rarr;</span> Document has raw PII and customer emails</div>
      </div>
      <div class="scenario">
        <div class="label caught">Context flagged</div>
        <div class="says">User says: <strong>"Revenue forecast"</strong> in #general</div>
        <div class="actual"><span class="arrow">&rarr;</span> Confidential financial data in a public channel</div>
      </div>
      <div class="scenario">
        <div class="label caught">External leak caught</div>
        <div class="says">User says: <strong>"Project update"</strong> in Slack Connect channel</div>
        <div class="actual"><span class="arrow">&rarr;</span> Internal roadmap shared with external partners</div>
      </div>
      <div class="scenario">
        <div class="label safe">Verified safe</div>
        <div class="says">User says: <strong>"Invoice attached"</strong></div>
        <div class="actual"><span class="arrow">&rarr;</span> Actual invoice in #finance (private)</div>
      </div>
      <div class="scenario">
        <div class="label safe">Verified safe</div>
        <div class="says">User says: <strong>"Updated logo"</strong></div>
        <div class="actual"><span class="arrow">&rarr;</span> Image of a logo in #design</div>
      </div>
    </div>
  </div>

  <!-- Features -->
  <div class="section">
    <h2>Product Features</h2>
    <p class="subtitle">Everything you need to prevent data leaks through messaging platforms.</p>
    <div class="features-grid">

      <div class="feature-card">
        <span class="badge badge-core">Core</span>
        <h3>Intent vs Content Verification</h3>
        <p>AI analyzes whether the file content matches what the user claims it is. Catches mis-sends where users accidentally share the wrong file.</p>
      </div>

      <div class="feature-card">
        <span class="badge badge-core">Core</span>
        <h3>AI Vision Analysis</h3>
        <p>Images are analyzed using GPT-4o vision to understand what's actually depicted. Screenshots, documents, diagrams — all verified against stated intent.</p>
      </div>

      <div class="feature-card">
        <span class="badge badge-new">New</span>
        <h3>Recipient-Aware Scanning</h3>
        <p>Automatically detects when sensitive content is shared in public channels, Slack Connect channels with external guests, or large channels with high blast radius.</p>
      </div>

      <div class="feature-card">
        <span class="badge badge-new">New</span>
        <h3>Channel Context Intelligence</h3>
        <p>Factors in channel name, purpose, topic, privacy level, and membership size. Financial data in #random gets flagged; the same data in #finance-team doesn't.</p>
      </div>

      <div class="feature-card">
        <span class="badge badge-security">Security</span>
        <h3>Slack Connect Leak Prevention</h3>
        <p>Any internal-only content shared in a Slack Connect channel with external organizations is flagged with high confidence — preventing leaks to outside parties.</p>
      </div>

      <div class="feature-card">
        <span class="badge badge-core">Core</span>
        <h3>Tiered Alert System</h3>
        <p>Three response tiers based on confidence: emoji-only for low confidence, thread warning for medium, and direct message to the sender for high-confidence mismatches.</p>
      </div>

      <div class="feature-card">
        <span class="badge badge-security">Security</span>
        <h3>Zero Content Retention</h3>
        <p>File contents and message text are never stored. Only privacy-safe metadata is persisted: one-way message hashes (SHA-256), structured classification labels, and templated risk summaries. No raw user content ever reaches the database or logs.</p>
      </div>

      <div class="feature-card">
        <span class="badge badge-security">Security</span>
        <h3>Automatic Data Expiry</h3>
        <p>Evaluation records are automatically purged after a configurable retention period (default: 90 days). Ensures compliance with data minimization requirements.</p>
      </div>

      <div class="feature-card">
        <span class="badge badge-security">Security</span>
        <h3>Defense-in-Depth Logging</h3>
        <p>Pino-based structured logging with automatic redaction of sensitive fields. User messages, file URLs, and AI reasoning are censored from all log output as a safety net.</p>
      </div>

      <div class="feature-card">
        <span class="badge badge-core">Core</span>
        <h3>Real-Time Slack Integration</h3>
        <p>Hooks into Slack's Events API for instant analysis. Messages are acknowledged in under 3 seconds with async processing behind the scenes.</p>
      </div>

      <div class="feature-card">
        <span class="badge badge-admin">Admin</span>
        <h3>Admin Dashboard</h3>
        <p>Paginated evaluation history with match status, confidence levels, context risk scores, intent labels, mismatch categories, and file classifications. Full audit trail at a glance.</p>
      </div>

      <div class="feature-card">
        <span class="badge badge-admin">Admin</span>
        <h3>Configurable Thresholds</h3>
        <p>Set your own warning and DM notification thresholds. Tune sensitivity to match your organization's risk tolerance.</p>
      </div>

      <div class="feature-card">
        <span class="badge badge-admin">Admin</span>
        <h3>Channel Filtering</h3>
        <p>Monitor all channels or only specific ones. Target high-risk channels like external-facing or executive channels.</p>
      </div>

      <div class="feature-card">
        <span class="badge badge-admin">Admin</span>
        <h3>Kill Switch</h3>
        <p>Instantly enable or disable analysis without restarting. Perfect for maintenance, tuning, or emergency situations.</p>
      </div>

      <div class="feature-card">
        <span class="badge badge-security">Security</span>
        <h3>Fail-Open Design</h3>
        <p>Errors never block user messages. If analysis fails, the message goes through and is marked as "uncertain" — user productivity is never impacted.</p>
      </div>

      <div class="feature-card">
        <span class="badge badge-core">Core</span>
        <h3>Multi-File Analysis</h3>
        <p>Analyzes all files in a single message. If any file is a mismatch, the entire message is flagged. Images get vision analysis; other files get metadata-based assessment.</p>
      </div>

    </div>
  </div>

  <!-- CTA -->
  <div class="cta">
    <h2>Stop data leaks before they happen</h2>
    <p>IntentGuard installs in minutes and starts protecting your workspace immediately.</p>
    <div class="buttons">
      <a class="btn-primary" href="mailto:contact@intentguard.dev">Get Started</a>
      <a class="btn-secondary" href="/admin/evaluations">View Dashboard Demo</a>
    </div>
  </div>

  <div class="footer">IntentGuard &mdash; AI-powered Data Loss Prevention for modern teams</div>

</body>
</html>`);
});

module.exports = router;

const express = require('express');
const { buildNav, buildHead } = require('../lib/nav');

const router = express.Router();

const PAGE_STYLE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #e6edf3; line-height: 1.7; }
  .content { max-width: 720px; margin: 0 auto; padding: 32px 24px 80px; }
  h1 { font-size: 28px; margin-bottom: 8px; }
  .meta { color: #768390; margin-bottom: 32px; font-size: 14px; }
  h2 { font-size: 18px; margin: 28px 0 12px; color: #e6edf3; }
  p, li { font-size: 15px; color: #c9d1d9; margin-bottom: 12px; }
  ul { padding-left: 24px; }
  a { color: #58a6ff; }
  .card { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 24px; margin-top: 24px; }
  .card h3 { font-size: 16px; margin-bottom: 8px; }
`;

router.get('/privacy', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  ${buildHead({
    title: 'Intentify AI — Privacy Policy',
    description: 'Intentify AI privacy policy. Zero content retention — we store only privacy-safe metadata. Message text is SHA-256 hashed. File contents are never stored.',
    path: '/privacy',
  })}
  <style>${PAGE_STYLE}</style>
</head>
<body>
  ${buildNav('')}
  <div class="content">
    <h1>Privacy Policy</h1>
    <p class="meta">Last updated: February 21, 2026</p>

    <h2>What Intentify AI Does</h2>
    <p>Intentify AI is a data loss prevention (DLP) tool for Slack. When a user shares a file in a monitored channel, Intentify AI verifies that the file content matches the user's stated intent and is appropriate for the audience. It does this using a combination of regex-based heuristics and AI analysis.</p>

    <h2>Data We Collect</h2>
    <p>Intentify AI is designed around a <strong>zero content retention</strong> principle. Here is exactly what we store and what we don't:</p>

    <h3 style="margin-top:16px;font-size:15px;color:#3fb950;">What we store (privacy-safe metadata only)</h3>
    <ul>
      <li><strong>One-way hash</strong> of the message text (SHA-256) — cannot be reversed to recover the original text</li>
      <li><strong>Slack user ID and channel ID</strong> — identifies who sent the message and where</li>
      <li><strong>Structured classification labels</strong> — e.g. "financial_document", "mismatch" — never raw content</li>
      <li><strong>Templated risk summaries</strong> — short descriptions generated from labels, not from actual file content</li>
      <li><strong>File metadata</strong> — file name, type, size, and analysis method used</li>
      <li><strong>Workspace ID</strong> — to scope data to your workspace</li>
    </ul>

    <h3 style="margin-top:16px;font-size:15px;color:#f85149;">What we never store</h3>
    <ul>
      <li>Message text (scrubbed from memory after processing)</li>
      <li>File contents or file URLs</li>
      <li>AI reasoning or detailed findings</li>
      <li>User emails, real names, or profile information</li>
    </ul>

    <h2>How We Use Data</h2>
    <ul>
      <li><strong>Real-time analysis:</strong> message text and file contents are processed in memory to determine if there's a mismatch. They are discarded immediately after.</li>
      <li><strong>Dashboard and audit trail:</strong> the privacy-safe metadata listed above powers the admin dashboard for workspace administrators.</li>
      <li><strong>Aggregated statistics:</strong> monthly rollups are computed for the analytics dashboard. These contain only counts and labels, never user content.</li>
    </ul>

    <h2>AI Processing</h2>
    <p>Intentify AI uses <strong>OpenAI GPT-4o-mini</strong> for file analysis. When AI analysis is triggered:</p>
    <ul>
      <li>Message text and file content are sent to OpenAI's API for a single inference call</li>
      <li>OpenAI's API data usage policy applies — as of our last review, data sent via the API is <strong>not used to train models</strong></li>
      <li><strong>Intentify AI does not use Slack data to train any language models</strong></li>
      <li>AI responses are used in real-time and are not persisted</li>
    </ul>

    <h2>Data Retention</h2>
    <ul>
      <li>Evaluation metadata is automatically deleted after a configurable retention period (default: 90 days)</li>
      <li>Workspace administrators can change the retention period or set it to 0 (keep forever) from the dashboard</li>
      <li>When a workspace uninstalls Intentify AI, the workspace is marked inactive. Contact us to request full data deletion.</li>
    </ul>

    <h2>Data Sharing</h2>
    <p>We do not sell, rent, or share your data with third parties. The only external service that processes your data is OpenAI (for AI analysis), subject to their <a href="https://openai.com/enterprise-privacy" target="_blank">enterprise privacy policy</a>.</p>

    <h2>Your Rights</h2>
    <p>You have the right to:</p>
    <ul>
      <li><strong>Access</strong> your workspace's stored data via the admin dashboard</li>
      <li><strong>Delete</strong> your data by adjusting retention settings or contacting us</li>
      <li><strong>Export</strong> your data by contacting us at the address below</li>
      <li><strong>Opt out</strong> of analysis entirely via the "Analysis enabled" toggle in workspace settings</li>
    </ul>

    <h2>Security</h2>
    <ul>
      <li>All traffic is encrypted via TLS 1.2+</li>
      <li>Slack webhook requests are verified using HMAC-SHA256 signatures</li>
      <li>Admin sessions use signed cookies with HMAC-SHA256</li>
      <li>OAuth tokens are stored encrypted in the database</li>
      <li>Sensitive fields are automatically redacted from all log output</li>
    </ul>

    <h2>Contact</h2>
    <p>For privacy questions, data requests, or concerns:</p>
    <div class="card">
      <p>Email: <a href="mailto:privacy@intentify.tech">privacy@intentify.tech</a></p>
    </div>
  </div>
</body>
</html>`);
});

router.get('/support', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  ${buildHead({
    title: 'Intentify AI — Support',
    description: 'Get help with Intentify AI. Installation guide, FAQ, and contact information for Slack DLP support.',
    path: '/support',
  })}
  <style>${PAGE_STYLE}</style>
</head>
<body>
  ${buildNav('')}
  <div class="content">
    <h1>Support</h1>
    <p class="meta">We're here to help. Reach out through any of the channels below.</p>

    <div class="card">
      <h3>Email Support</h3>
      <p>For general questions, bug reports, or feature requests:</p>
      <p><a href="mailto:support@intentify.tech">support@intentify.tech</a></p>
      <p style="color:#768390;font-size:13px;">We respond within 2 business days.</p>
    </div>

    <div class="card">
      <h3>GitHub Issues</h3>
      <p>For bug reports and technical issues:</p>
      <p><a href="https://github.com/ynevet/intentguard/issues" target="_blank">github.com/ynevet/intentguard/issues</a></p>
    </div>

    <h2>Common Questions</h2>

    <h3 style="margin-top:16px;font-size:15px;">How do I install Intentify AI?</h3>
    <p>Visit <a href="/slack/oauth/install">Add to Slack</a> and click the install button. You'll need to be a Slack workspace admin or owner.</p>

    <h3 style="margin-top:16px;font-size:15px;">How do I access the admin dashboard?</h3>
    <p>After installing, go to your Intentify AI dashboard and sign in with Slack. Only workspace admins and owners can access the dashboard.</p>

    <h3 style="margin-top:16px;font-size:15px;">How do I disable analysis?</h3>
    <p>In the admin dashboard, go to Evaluations and toggle "Analysis enabled" off. This immediately stops all scanning for your workspace.</p>

    <h3 style="margin-top:16px;font-size:15px;">How do I uninstall Intentify AI?</h3>
    <p>Go to your Slack workspace settings &rarr; Manage Apps &rarr; Intentify AI &rarr; Remove. Your stored metadata will be automatically deleted after the configured retention period, or you can <a href="mailto:support@intentify.tech">contact us</a> for immediate deletion.</p>

    <h3 style="margin-top:16px;font-size:15px;">Does Intentify AI read my messages?</h3>
    <p>Intentify AI only processes messages that contain file attachments. Message text is analyzed in real-time to understand intent, then immediately discarded. Only a one-way SHA-256 hash is stored — the original text cannot be recovered. See our <a href="/privacy">Privacy Policy</a> for full details.</p>

    <h3 style="margin-top:16px;font-size:15px;">What data does Intentify AI store?</h3>
    <p>Only privacy-safe metadata: message hashes, classification labels, risk scores, and file metadata. Never message text, file contents, or AI reasoning. See our <a href="/privacy">Privacy Policy</a>.</p>
  </div>
</body>
</html>`);
});

module.exports = router;

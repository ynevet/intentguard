const express = require('express');
const { buildNav } = require('../lib/nav');
const router = express.Router();

router.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Intentify AI — Prevent Data Leaks Before They Happen</title>
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
    .hero img { height: 280px; width: 280px; margin-bottom: 32px; border-radius: 56px; }
    .hero h1 { font-size: 42px; font-weight: 700; margin-bottom: 16px; max-width: 720px; margin-left: auto; margin-right: auto; }
    .hero h1 span { background: linear-gradient(135deg, #58a6ff, #3fb950); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .hero .tagline { font-size: 20px; color: #8b949e; max-width: 640px; margin: 0 auto 24px; }
    .hero .stat { display: inline-block; background: rgba(218,54,51,0.15); border: 1px solid rgba(218,54,51,0.3); border-radius: 8px; padding: 8px 20px; font-size: 15px; color: #f85149; margin-bottom: 28px; }
    .hero .buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

    /* Buttons */
    a.btn {
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

    /* Section */
    .section { max-width: 960px; margin: 0 auto; padding: 60px 24px; }
    .section h2 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .section .subtitle { font-size: 16px; color: #8b949e; margin-bottom: 40px; }

    /* Blindspot columns */
    .blindspot-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    @media (max-width: 640px) { .blindspot-grid { grid-template-columns: 1fr; } }
    .blindspot-col {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 28px 24px;
    }
    .blindspot-col h3 { font-size: 16px; margin-bottom: 16px; }
    .blindspot-col.traditional h3 { color: #8b949e; }
    .blindspot-col.intentguard h3 { color: #3fb950; }
    .blindspot-col ul { list-style: none; padding: 0; }
    .blindspot-col ul li { font-size: 14px; color: #c9d1d9; padding: 6px 0; padding-left: 24px; position: relative; }
    .blindspot-col ul li::before { position: absolute; left: 0; }
    .blindspot-col.traditional ul li::before { content: '\\2713'; color: #8b949e; }
    .blindspot-col.intentguard ul li::before { content: '\\2713'; color: #3fb950; }

    /* Scenarios */
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

    /* Flow */
    .flow {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 40px;
      font-size: 14px;
    }
    .flow-step {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 8px;
      padding: 10px 16px;
      color: #c9d1d9;
      white-space: nowrap;
    }
    .flow-arrow { color: #484f58; font-size: 18px; }

    /* Axes */
    .axes {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
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
    .axis .note { font-size: 13px; color: #58a6ff; margin-top: 8px; font-style: italic; }

    /* Comparison table */
    .comparison-wrap {
      overflow-x: auto;
      margin-bottom: 20px;
    }
    .comparison {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .comparison th, .comparison td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #21262d;
    }
    .comparison th { color: #e6edf3; font-weight: 600; background: #161b22; }
    .comparison th:first-child { color: #8b949e; font-weight: 400; }
    .comparison td { color: #c9d1d9; }
    .comparison td:first-child { color: #8b949e; }
    .comparison .check { color: #3fb950; font-weight: 700; }
    .comparison .cross { color: #484f58; }

    /* Pricing */
    .pricing-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 20px;
    }
    @media (max-width: 640px) { .pricing-grid { grid-template-columns: 1fr; } }
    .pricing-card {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 32px 28px;
    }
    .pricing-card.featured { border-color: #1f6feb; }
    .pricing-card h3 { font-size: 20px; margin-bottom: 4px; }
    .pricing-card .price { font-size: 32px; font-weight: 700; margin-bottom: 4px; }
    .pricing-card .price-note { font-size: 13px; color: #8b949e; margin-bottom: 20px; }
    .pricing-card ul { list-style: none; padding: 0; margin-bottom: 24px; }
    .pricing-card ul li { font-size: 14px; color: #c9d1d9; padding: 5px 0 5px 24px; position: relative; }
    .pricing-card ul li::before { content: '\\2713'; position: absolute; left: 0; color: #3fb950; }
    .pricing-card .btn { width: 100%; text-align: center; }
    .pricing-note { font-size: 13px; color: #8b949e; text-align: center; }

    /* AI Disclosure */
    .disclosure {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 28px 24px;
    }
    .disclosure p { font-size: 14px; color: #c9d1d9; margin-bottom: 12px; }
    .disclosure p:last-child { margin-bottom: 0; }

    /* CTA */
    .cta {
      text-align: center;
      padding: 60px 24px 80px;
      border-top: 1px solid #21262d;
    }
    .cta h2 { font-size: 28px; margin-bottom: 12px; }
    .cta p { font-size: 16px; color: #8b949e; margin-bottom: 28px; }
    .cta .buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

    /* Footer */
    .footer { text-align: center; padding: 24px; font-size: 13px; color: #484f58; border-top: 1px solid #21262d; }
  </style>
</head>
<body>

  ${buildNav('features', req.session)}

  <!-- Hero -->
  <div class="hero">
    <img src="/public/logo.png" alt="Intentify AI logo">
    <h1>Your DLP is missing the <span>#1 cause of data leaks</span></h1>
    <p class="tagline">Traditional tools catch SSNs and credit cards. They completely miss when someone sends the wrong file.</p>
    <div class="stat">80% of insider data breaches start with a mis-send</div>
    <div class="buttons">
      <a class="btn btn-primary" href="/slack/oauth/install">Add to Slack &mdash; free</a>
      <a class="btn btn-secondary" href="#how-it-works">See how it works</a>
    </div>
  </div>

  <!-- The Blindspot -->
  <div class="section">
    <h2>The Blindspot</h2>
    <p class="subtitle">Traditional DLP tools only look at content patterns. They never check if the file matches what the sender said it was.</p>
    <div class="blindspot-grid">
      <div class="blindspot-col traditional">
        <h3>Traditional DLP catches</h3>
        <ul>
          <li>Social Security numbers</li>
          <li>Credit card numbers</li>
          <li>Regex patterns</li>
          <li>Keyword blacklists</li>
        </ul>
      </div>
      <div class="blindspot-col intentguard">
        <h3>Intentify AI also catches</h3>
        <ul>
          <li>Wrong file attached to the message</li>
          <li>"Anonymized" reports with raw PII</li>
          <li>Confidential data in public channels</li>
          <li>Internal docs in Slack Connect</li>
          <li>Sensitive screenshots and images</li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Real-world scenarios -->
  <div class="section">
    <h2>What Intentify AI Catches</h2>
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

  <!-- How it works -->
  <div class="section" id="how-it-works">
    <h2>How It Works</h2>
    <p class="subtitle">Three-axis verification in seconds. Works silently &mdash; users only see a notification when something's wrong.</p>
    <div class="flow">
      <span class="flow-step">Message sent</span>
      <span class="flow-arrow">&rarr;</span>
      <span class="flow-step">Intent parsed</span>
      <span class="flow-arrow">&rarr;</span>
      <span class="flow-step">Content analyzed</span>
      <span class="flow-arrow">&rarr;</span>
      <span class="flow-step">Context checked</span>
      <span class="flow-arrow">&rarr;</span>
      <span class="flow-step">Verdict in seconds</span>
    </div>
    <div class="axes">
      <div class="axis">
        <div class="icon">&#x1F4AC;</div>
        <h3>Intent</h3>
        <p>What the user <em>says</em> the file is. We parse the message text to understand the sender's stated purpose.</p>
      </div>
      <div class="axis">
        <div class="icon">&#x1F50D;</div>
        <h3>Content</h3>
        <p>What's <em>actually inside</em> the file. AI vision for images; text extraction for documents, spreadsheets, and more.</p>
      </div>
      <div class="axis">
        <div class="icon">&#x1F310;</div>
        <h3>Context</h3>
        <p>Whether the content is <em>appropriate for the audience</em>. Channel type, membership, external guests, and privacy level.</p>
      </div>
    </div>
  </div>

  <!-- Comparison table -->
  <div class="section">
    <h2>Intentify AI vs Traditional DLP</h2>
    <p class="subtitle">A direct comparison of capabilities.</p>
    <div class="comparison-wrap">
      <table class="comparison">
        <thead>
          <tr>
            <th></th>
            <th>Intentify AI</th>
            <th>Traditional DLP</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Setup time</td>
            <td>2 minutes</td>
            <td>Days / weeks</td>
          </tr>
          <tr>
            <td>Intent vs content verification</td>
            <td class="check">&#10003;</td>
            <td class="cross">&#10007;</td>
          </tr>
          <tr>
            <td>Content pattern matching</td>
            <td class="check">&#10003;</td>
            <td class="check">&#10003;</td>
          </tr>
          <tr>
            <td>AI vision (images / screenshots)</td>
            <td class="check">&#10003;</td>
            <td class="cross">&#10007;</td>
          </tr>
          <tr>
            <td>Channel audience awareness</td>
            <td class="check">&#10003;</td>
            <td class="cross">&#10007;</td>
          </tr>
          <tr>
            <td>Content retention</td>
            <td>Zero</td>
            <td>Stores content</td>
          </tr>
          <tr>
            <td>Auth</td>
            <td>Sign in with Slack</td>
            <td>Separate portal</td>
          </tr>
          <tr>
            <td>Pricing</td>
            <td>Free (self-hosted)</td>
            <td>Per-seat licensing</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Pricing -->
  <div class="section">
    <h2>Pricing</h2>
    <p class="subtitle">Simple, transparent pricing. No per-seat fees.</p>
    <div class="pricing-grid">
      <div class="pricing-card featured">
        <h3>Community</h3>
        <div class="price">Free</div>
        <div class="price-note">Self-hosted, forever</div>
        <ul>
          <li>Unlimited workspaces</li>
          <li>All core detection features</li>
          <li>Admin dashboard</li>
          <li>90-day retention</li>
          <li>Community support</li>
        </ul>
        <a class="btn btn-primary" href="/slack/oauth/install">Add to Slack</a>
      </div>
      <div class="pricing-card">
        <h3>Pro</h3>
        <div class="price">Coming Soon</div>
        <div class="price-note">Everything in Community, plus:</div>
        <ul>
          <li>Priority support</li>
          <li>Custom retention policies</li>
          <li>Audit log export</li>
          <li>SLA guarantee</li>
          <li>Dedicated onboarding</li>
        </ul>
        <a class="btn btn-secondary" href="mailto:sales@intentify.ai">Join waitlist</a>
      </div>
    </div>
    <p class="pricing-note">Intentify AI is self-hosted. You only pay for your own OpenAI API usage.</p>
  </div>

  <!-- AI Disclosure -->
  <div class="section" style="border-top:1px solid #21262d;padding-top:40px;">
    <h2>AI Transparency</h2>
    <p class="subtitle">How Intentify AI uses artificial intelligence.</p>
    <div class="disclosure">
      <p><strong>Model:</strong> OpenAI GPT-4o-mini (vision + text). Analysis runs via the OpenAI API on a per-request basis.</p>
      <p><strong>Data retention:</strong> File contents and message text are processed in memory only and never stored. AI responses are used in real-time and immediately discarded. Only privacy-safe metadata (classification labels, risk scores) is persisted.</p>
      <p><strong>Training:</strong> Intentify AI does not use Slack data to train any language models. OpenAI's API data is not used for model training per their enterprise privacy policy.</p>
      <p><strong>Tenancy:</strong> Each workspace's data is isolated. Analysis requests are stateless and contain no data from other workspaces.</p>
      <p><strong>Accuracy:</strong> AI analysis may occasionally produce incorrect results. Intentify AI uses a fail-open design &mdash; uncertain results never block user messages. Administrators can review all verdicts in the dashboard and adjust sensitivity thresholds.</p>
    </div>
  </div>

  <!-- CTA -->
  <div class="cta">
    <h2>Stop data leaks before they happen</h2>
    <p>One-click install. Works in minutes. No sales call required.</p>
    <div class="buttons">
      <a class="btn btn-primary" href="/slack/oauth/install">Add to Slack &mdash; free</a>
      <a class="btn btn-secondary" href="/admin/evaluations">View Dashboard Demo</a>
    </div>
  </div>

  <div class="footer">
    Intentify AI &mdash; AI-powered Data Loss Prevention for modern teams
    <br><span style="font-size:12px;"><a href="/privacy" style="color:#484f58;text-decoration:none;">Privacy Policy</a> &middot; <a href="/support" style="color:#484f58;text-decoration:none;">Support</a></span>
  </div>

</body>
</html>`);
});

module.exports = router;

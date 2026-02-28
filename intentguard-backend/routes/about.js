const express = require('express');
const { buildNav, buildHead } = require('../lib/nav');
const router = express.Router();

router.get('/', (req, res) => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About Intentify AI',
    url: 'https://intentify.tech/about',
    description: 'AI-powered data loss prevention that catches the #1 cause of enterprise data leaks: wrong file attachments.',
    publisher: {
      '@type': 'Organization',
      name: 'Intentify AI',
      url: 'https://intentify.tech',
      logo: 'https://intentify.tech/public/logo.png',
    },
  };
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  ${buildHead({
    title: 'About Intentify AI — Intelligent Enterprise Data Protection',
    description: 'Intentify AI closes the #1 blindspot in enterprise DLP: wrong file attachments. Three-axis verification with zero content retention. Learn about our mission, technology, and team.',
    path: '/about',
    jsonLd,
  })}
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
    .hero img { height: 120px; width: 120px; margin-bottom: 24px; border-radius: 24px; }
    .hero h1 { font-size: 42px; font-weight: 700; margin-bottom: 16px; max-width: 720px; margin-left: auto; margin-right: auto; }
    .hero h1 span { background: linear-gradient(135deg, #58a6ff, #3fb950); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .hero .tagline { font-size: 20px; color: #8b949e; max-width: 640px; margin: 0 auto 28px; }
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

    /* Stat cards */
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 24px;
    }
    @media (max-width: 640px) { .stat-grid { grid-template-columns: 1fr; } }
    .stat-card {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 28px 24px;
      text-align: center;
    }
    .stat-card .number { font-size: 36px; font-weight: 700; color: #f85149; margin-bottom: 8px; }
    .stat-card .label { font-size: 14px; color: #c9d1d9; margin-bottom: 4px; }
    .stat-card .source { font-size: 12px; color: #484f58; }

    /* Axes */
    .axes {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
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

    /* Differentiators grid */
    .diff-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 640px) { .diff-grid { grid-template-columns: 1fr; } }
    .diff-card {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 28px 24px;
    }
    .diff-card .icon { font-size: 28px; margin-bottom: 12px; }
    .diff-card h3 { font-size: 18px; margin-bottom: 8px; color: #e6edf3; }
    .diff-card p { font-size: 14px; color: #8b949e; }

    /* Team */
    .team-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }
    .team-card {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 28px 24px;
      text-align: center;
    }
    .team-card .avatar {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1f6feb, #3fb950);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      font-size: 28px;
      font-weight: 700;
      color: #fff;
    }
    .team-card h3 { font-size: 16px; margin-bottom: 4px; }
    .team-card .role { font-size: 13px; color: #8b949e; }

    /* CTA */
    .cta {
      text-align: center;
      padding: 60px 24px 80px;
      border-top: 1px solid #21262d;
    }
    .cta h2 { font-size: 28px; margin-bottom: 12px; }
    .cta p { font-size: 16px; color: #8b949e; margin-bottom: 28px; }
    .cta .buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

    /* Video */
    .video-wrap { max-width: 720px; margin: 40px auto 0; }
    .video-container { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; border: 1px solid #21262d; }
    .video-container iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }

    /* Footer */
    .footer { text-align: center; padding: 24px; font-size: 13px; color: #484f58; border-top: 1px solid #21262d; }
  </style>
</head>
<body>

  ${buildNav('about', req.session)}

  <!-- Hero -->
  <div class="hero">
    <img src="/public/logo.png" alt="Intentify AI logo">
    <h1>Making enterprise data protection <span>intelligent</span></h1>
    <p class="tagline">Next-generation DLP that understands what users mean, not just what files contain. AI-powered, privacy-first, deployed in minutes.</p>
    <div class="buttons">
      <a class="btn btn-primary" href="/slack/oauth/install">Get Started</a>
      <a class="btn btn-secondary" href="/features">See Features</a>
    </div>
  </div>

  <!-- The Problem -->
  <div class="section">
    <h2>The $4.88M Problem</h2>
    <p class="subtitle">Data breaches keep getting more expensive, and the leading cause is one that traditional DLP completely ignores.</p>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="number">$4.88M</div>
        <div class="label">Average cost of a data breach</div>
        <div class="source">IBM Cost of a Data Breach 2024</div>
      </div>
      <div class="stat-card">
        <div class="number">68%</div>
        <div class="label">Breaches involve a human element</div>
        <div class="source">Verizon DBIR 2024</div>
      </div>
      <div class="stat-card">
        <div class="number">#1</div>
        <div class="label">Cause: sending the wrong file</div>
        <div class="source">Mis-sends &amp; misdirected data</div>
      </div>
    </div>
    <p style="font-size:15px;color:#8b949e;max-width:720px;">Traditional DLP tools scan for patterns like credit card numbers and SSNs. They are completely blind to the most common scenario: a user attaches the wrong file. No regex can catch someone sending Q1 financials when they meant to send a demo deck.</p>
  </div>

  <!-- Three-Axis Verification -->
  <div class="section" style="border-top:1px solid #21262d;padding-top:60px;">
    <h2>Three-Axis Verification</h2>
    <p class="subtitle">Intentify AI checks three dimensions on every file share to catch mis-sends that pattern matching cannot.</p>
    <div class="axes">
      <div class="axis">
        <div class="icon">&#x1F4AC;</div>
        <h3>Intent</h3>
        <p>What the sender <em>claims</em> the file is. We parse the message to understand stated purpose and expected content.</p>
      </div>
      <div class="axis">
        <div class="icon">&#x1F50D;</div>
        <h3>Content</h3>
        <p>What's <em>actually inside</em> the attachment. AI vision for images, text extraction for documents, spreadsheets, and presentations.</p>
      </div>
      <div class="axis">
        <div class="icon">&#x1F310;</div>
        <h3>Context</h3>
        <p>Whether the content is <em>appropriate for the audience</em>. Channel privacy, membership, external guests, and sensitivity level.</p>
      </div>
    </div>
    <p style="font-size:15px;color:#8b949e;max-width:720px;">When any axis misaligns, Intentify AI intervenes before the data leaves. It also runs conventional pattern detection for credit cards, SSNs, API keys, and other sensitive data &mdash; at zero API cost via heuristic pre-scan.</p>
    <div class="video-wrap">
      <h3 style="font-size:18px;text-align:center;margin-bottom:16px;color:#8b949e;">See it in action</h3>
      <div class="video-container">
        <iframe src="https://www.youtube.com/embed/R6s9ju1yZ6M" title="Intentify AI Slack Bot Demo" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
    </div>
  </div>

  <!-- Why Intentify AI -->
  <div class="section" style="border-top:1px solid #21262d;padding-top:60px;">
    <h2>Why Intentify AI</h2>
    <p class="subtitle">Built differently from legacy DLP &mdash; designed for how teams actually work today.</p>
    <div class="diff-grid">
      <div class="diff-card">
        <div class="icon">&#x1F512;</div>
        <h3>Zero Content Retention</h3>
        <p>File contents and message text are processed in memory and immediately discarded. Only privacy-safe metadata is stored. No training on your data, ever.</p>
      </div>
      <div class="diff-card">
        <div class="icon">&#x2705;</div>
        <h3>Fail-Open Design</h3>
        <p>Errors and uncertain results never block users. Intentify AI catches leaks without disrupting workflows &mdash; your team stays productive.</p>
      </div>
      <div class="diff-card">
        <div class="icon">&#x26A1;</div>
        <h3>Two Minutes to Deploy</h3>
        <p>One-click Slack install, no agents to deploy, no policies to write. Auto-joins channels and starts protecting immediately.</p>
      </div>
      <div class="diff-card">
        <div class="icon">&#x1F9E0;</div>
        <h3>AI + Heuristics</h3>
        <p>Two-stage detection: fast regex pre-scan (zero API cost) catches critical patterns instantly, then AI analyzes intent-content alignment for everything else.</p>
      </div>
    </div>
  </div>

  <!-- Team -->
  <div class="section" style="border-top:1px solid #21262d;padding-top:60px;">
    <h2>Team</h2>
    <p class="subtitle">The people building the future of data loss prevention.</p>
    <div class="team-grid">
      <div class="team-card">
        <div class="avatar">?</div>
        <h3>Coming Soon</h3>
        <div class="role">Founding Team</div>
      </div>
      <div class="team-card">
        <div class="avatar">?</div>
        <h3>Coming Soon</h3>
        <div class="role">Engineering</div>
      </div>
      <div class="team-card">
        <div class="avatar">?</div>
        <h3>Coming Soon</h3>
        <div class="role">Design</div>
      </div>
    </div>
  </div>

  <!-- CTA -->
  <div class="cta">
    <h2>Ready to close the blindspot?</h2>
    <p>One-click install. Works in minutes. Zero content retention.</p>
    <div class="buttons">
      <a class="btn btn-primary" href="/slack/oauth/install">Add to Slack &mdash; free</a>
      <a class="btn btn-secondary" href="/features">Explore Features</a>
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

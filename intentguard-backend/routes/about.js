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
    description: 'Intentify AI closes the #1 blindspot in enterprise DLP: wrong file attachments. Three-axis AI verification with zero content retention. Learn about our mission and technology.',
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

    /* ── Shared ── */
    a.btn {
      display: inline-block;
      padding: 12px 28px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.18s;
    }
    .btn-primary { background: #1f6feb; color: #fff; }
    .btn-primary:hover { background: #388bfd; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(31,111,235,0.35); }
    .btn-secondary { background: transparent; color: #e6edf3; border: 1px solid #30363d; }
    .btn-secondary:hover { background: #21262d; }

    .section { max-width: 960px; margin: 0 auto; padding: 72px 24px; }
    .section-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #58a6ff; margin-bottom: 12px; }
    .section-title { font-size: 32px; font-weight: 700; margin-bottom: 10px; line-height: 1.25; }
    .section-sub { font-size: 16px; color: #8b949e; margin-bottom: 40px; max-width: 620px; line-height: 1.6; }

    /* ── Mission hero ── */
    .mission {
      padding: 80px 24px 72px;
      background: radial-gradient(ellipse 70% 60% at 50% -10%, rgba(31,111,235,0.1) 0%, transparent 70%), #0d1117;
      border-bottom: 1px solid #21262d;
      text-align: center;
    }
    .mission-logo {
      width: 80px;
      height: 80px;
      border-radius: 18px;
      margin: 0 auto 28px;
      display: block;
    }
    .mission h1 {
      font-size: clamp(28px, 4.5vw, 44px);
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.4px;
      margin-bottom: 18px;
      max-width: 700px;
      margin-left: auto;
      margin-right: auto;
    }
    .mission h1 em {
      font-style: normal;
      background: linear-gradient(135deg, #58a6ff, #3fb950);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .mission-sub {
      font-size: 18px;
      color: #8b949e;
      max-width: 600px;
      margin: 0 auto 36px;
    }
    .mission-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

    /* ── Problem numbers ── */
    .numbers-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #21262d;
      margin-bottom: 36px;
    }
    @media (max-width: 640px) { .numbers-grid { grid-template-columns: 1fr; } }
    .number-cell {
      background: #161b22;
      padding: 32px 24px;
      text-align: center;
    }
    .number-cell + .number-cell { border-left: 1px solid #21262d; }
    @media (max-width: 640px) { .number-cell + .number-cell { border-left: none; border-top: 1px solid #21262d; } }
    .number-cell .big { font-size: 40px; font-weight: 800; color: #f85149; margin-bottom: 6px; }
    .number-cell .desc { font-size: 14px; color: #c9d1d9; margin-bottom: 4px; line-height: 1.4; }
    .number-cell .src { font-size: 11px; color: #484f58; }

    /* ── Blind spot explain ── */
    .explain-block {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 28px 32px;
      font-size: 15px;
      color: #8b949e;
      line-height: 1.7;
    }
    .explain-block strong { color: #e6edf3; }

    /* ── 3-Axis ── */
    .axes-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #21262d;
      margin-bottom: 32px;
    }
    @media (max-width: 640px) { .axes-grid { grid-template-columns: 1fr; } }
    .axis-cell {
      background: #161b22;
      padding: 28px 24px;
      position: relative;
    }
    .axis-cell + .axis-cell { border-left: 1px solid #21262d; }
    @media (max-width: 640px) { .axis-cell + .axis-cell { border-left: none; border-top: 1px solid #21262d; } }
    .axis-cell::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
    }
    .axis-cell.intent::before { background: linear-gradient(90deg, #58a6ff, #1f6feb); }
    .axis-cell.content::before { background: linear-gradient(90deg, #3fb950, #2ea043); }
    .axis-cell.context::before { background: linear-gradient(90deg, #d2a8ff, #a371f7); }
    .axis-cell .icon { font-size: 28px; margin-bottom: 12px; }
    .axis-cell h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
    .axis-cell p { font-size: 14px; color: #8b949e; line-height: 1.5; }

    .vs-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(31,111,235,0.08);
      border: 1px solid rgba(31,111,235,0.2);
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 14px;
      color: #58a6ff;
      margin-bottom: 28px;
    }
    .vs-badge .arrow { color: #484f58; }

    /* ── Why different ── */
    .diff-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    @media (max-width: 600px) { .diff-grid { grid-template-columns: 1fr; } }
    .diff-card {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }
    .diff-icon { font-size: 22px; flex-shrink: 0; margin-top: 2px; }
    .diff-card h3 { font-size: 15px; font-weight: 600; margin-bottom: 5px; }
    .diff-card p { font-size: 13px; color: #8b949e; line-height: 1.5; }

    /* ── Tech stack ── */
    .stack-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }
    .stack-item {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 10px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .stack-icon { font-size: 20px; flex-shrink: 0; }
    .stack-name { font-size: 13px; font-weight: 600; color: #c9d1d9; }
    .stack-desc { font-size: 12px; color: #484f58; margin-top: 2px; }

    /* ── Video ── */
    .video-wrap { max-width: 760px; margin: 32px auto 0; }
    .video-container { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; border: 1px solid #21262d; box-shadow: 0 16px 48px rgba(0,0,0,0.4); }
    .video-container iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }

    /* ── Roadmap / status ── */
    .roadmap-list { list-style: none; padding: 0; }
    .roadmap-list li {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      padding: 16px 0;
      border-bottom: 1px solid #21262d;
      font-size: 14px;
    }
    .roadmap-list li:last-child { border-bottom: none; }
    .road-status {
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 100px;
      white-space: nowrap;
      margin-top: 1px;
    }
    .road-status.live { background: rgba(63,185,80,0.12); color: #3fb950; border: 1px solid rgba(63,185,80,0.25); }
    .road-status.soon { background: rgba(88,166,255,0.1); color: #58a6ff; border: 1px solid rgba(88,166,255,0.2); }
    .road-status.planned { background: rgba(72,79,88,0.2); color: #8b949e; border: 1px solid #30363d; }
    .road-text strong { color: #e6edf3; }
    .road-text p { color: #8b949e; margin-top: 2px; }

    /* ── CTA ── */
    .cta {
      text-align: center;
      padding: 80px 24px;
      background: radial-gradient(ellipse 60% 80% at 50% 0%, rgba(31,111,235,0.08) 0%, transparent 70%);
      border-top: 1px solid #21262d;
    }
    .cta h2 { font-size: 32px; font-weight: 800; margin-bottom: 12px; }
    .cta p { font-size: 16px; color: #8b949e; margin-bottom: 32px; }
    .cta-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

    /* ── Footer ── */
    .footer { text-align: center; padding: 28px 24px; font-size: 13px; color: #484f58; border-top: 1px solid #21262d; }
    .footer a { color: #484f58; text-decoration: none; }
    .footer a:hover { color: #8b949e; }
    .footer-links { margin-top: 8px; display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }

    /* ══════════════════════════════════════════
       RESPONSIVE — MOBILE
    ══════════════════════════════════════════ */

    @media (max-width: 768px) {
      /* Mission hero */
      .mission { padding: 56px 20px 52px; }
      .mission-logo { width: 64px; height: 64px; margin-bottom: 20px; border-radius: 14px; }
      .mission-sub { font-size: 16px; }
      .mission-actions .btn { padding: 11px 22px; font-size: 14px; }

      /* Sections */
      .section { padding: 52px 20px; }
      .section-title { font-size: 26px; }
      .section-sub { font-size: 15px; margin-bottom: 28px; }

      /* Numbers */
      .number-cell { padding: 24px 18px; }
      .number-cell .big { font-size: 34px; }

      /* Explain block */
      .explain-block { padding: 22px 20px; font-size: 14px; }

      /* vs-badge wraps gracefully */
      .vs-badge { flex-wrap: wrap; gap: 6px; font-size: 13px; }

      /* 3-Axis */
      .axes-grid { gap: 0; } /* already 2px, fine */
      .axis-cell { padding: 22px 18px; }
      .axis-cell .icon { font-size: 24px; }
      .axis-cell h3 { font-size: 15px; }
      .axis-cell p { font-size: 13px; }

      /* Why different */
      .diff-grid { gap: 12px; }
      .diff-card { padding: 18px; }
      .diff-card h3 { font-size: 14px; }
      .diff-card p { font-size: 13px; }

      /* Tech stack */
      .stack-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
      .stack-item { padding: 14px; }
      .stack-name { font-size: 12px; }
      .stack-desc { font-size: 11px; }

      /* Roadmap */
      .roadmap-list li { gap: 12px; font-size: 13px; flex-wrap: wrap; }
      .road-status { margin-top: 0; }

      /* CTA */
      .cta { padding: 60px 20px; }
      .cta h2 { font-size: 26px; }
      .cta p { font-size: 15px; }
    }

    @media (max-width: 480px) {
      .mission { padding: 44px 16px 44px; }
      .mission-logo { width: 56px; height: 56px; }
      .mission-actions { flex-direction: column; align-items: stretch; gap: 10px; }
      .mission-actions .btn { text-align: center; }

      .section { padding: 44px 16px; }
      .section-title { font-size: 22px; }
      .section-sub { font-size: 14px; }

      .number-cell .big { font-size: 30px; }
      .explain-block { padding: 18px 16px; font-size: 13px; }

      /* vs-badge stacks vertically */
      .vs-badge { flex-direction: column; align-items: flex-start; gap: 4px; }

      /* Roadmap — status badge above text on very small screens */
      .roadmap-list li { flex-direction: column; gap: 6px; }

      /* Stack grid 2 cols */
      .stack-grid { grid-template-columns: repeat(2, 1fr); }

      .cta { padding: 48px 16px; }
      .cta h2 { font-size: 22px; }
      .cta-actions { flex-direction: column; align-items: stretch; gap: 10px; }
      .cta-actions .btn { text-align: center; }

      .video-wrap { margin: 24px auto 0; }
    }
  </style>
</head>
<body>

  ${buildNav('about', req.session)}

  <!-- ── Mission ── -->
  <section class="mission">
    <img src="/public/logo.png" alt="Intentify AI" class="mission-logo">
    <h1>Protecting teams from the leak<br><em>no one was watching for</em></h1>
    <p class="mission-sub">We built Intentify AI because every enterprise DLP tool we tried was blind to the most common data incident: someone attaching the wrong file.</p>
    <div class="mission-actions">
      <a class="btn btn-primary" href="/slack/oauth/install">Get started free</a>
      <a class="btn btn-secondary" href="/features">See features</a>
    </div>
  </section>

  <!-- ── The Problem ── -->
  <section class="section">
    <div class="section-label">The problem</div>
    <h2 class="section-title">Data breaches keep getting more expensive</h2>
    <p class="section-sub">And the leading cause is one that traditional DLP tools have never been able to address.</p>

    <div class="numbers-grid">
      <div class="number-cell">
        <div class="big">$4.88M</div>
        <div class="desc">Average cost of a data breach</div>
        <div class="src">IBM Cost of a Data Breach 2024</div>
      </div>
      <div class="number-cell">
        <div class="big">68%</div>
        <div class="desc">Of breaches involve a human element</div>
        <div class="src">Verizon DBIR 2024</div>
      </div>
      <div class="number-cell">
        <div class="big">#1</div>
        <div class="desc">Cause: sending the wrong file to the wrong person</div>
        <div class="src">Mis-sends &amp; misdirected data</div>
      </div>
    </div>

    <div class="explain-block">
      Traditional DLP tools scan for <strong>patterns inside files</strong> — credit card numbers, SSNs, regex matches. They are completely blind to the most common scenario: <strong>a user attaches the wrong file entirely</strong>. No pattern matcher can tell you that Q1 financials don't belong in the #general channel, or that the file attached doesn't match what the sender described. That's the blindspot Intentify AI closes.
    </div>
  </section>

  <!-- ── How it works ── -->
  <section class="section" style="border-top:1px solid #21262d;">
    <div class="section-label">Our approach</div>
    <h2 class="section-title">Three-axis verification</h2>
    <p class="section-sub">Every file share is evaluated across three independent dimensions — simultaneously, in real time, before the file reaches anyone.</p>

    <div class="vs-badge">
      <span>Intent</span>
      <span class="arrow">×</span>
      <span>Content</span>
      <span class="arrow">×</span>
      <span>Context</span>
      <span class="arrow">→</span>
      <span>Verdict in seconds</span>
    </div>

    <div class="axes-grid">
      <div class="axis-cell intent">
        <div class="icon">💬</div>
        <h3>Intent</h3>
        <p>What the sender <em>claims</em> the file is. We parse the message text to understand the stated purpose and expected content.</p>
      </div>
      <div class="axis-cell content">
        <div class="icon">🔍</div>
        <h3>Content</h3>
        <p>What's <em>actually inside</em> the attachment. AI vision for images, text extraction for PDFs, spreadsheets, presentations, and code.</p>
      </div>
      <div class="axis-cell context">
        <div class="icon">🌐</div>
        <h3>Context</h3>
        <p>Whether the content is <em>appropriate for the audience</em>. Channel privacy, member count, external guests, and sensitivity level.</p>
      </div>
    </div>

    <div class="video-wrap">
      <div class="video-container">
        <iframe src="https://www.youtube.com/embed/R6s9ju1yZ6M" title="Intentify AI Slack Bot Demo" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
    </div>
  </section>

  <!-- ── Why different ── -->
  <section class="section" style="border-top:1px solid #21262d;">
    <div class="section-label">Why Intentify AI</div>
    <h2 class="section-title">Built differently from legacy DLP</h2>
    <p class="section-sub">Designed for how teams actually work today — Slack-first, privacy-safe, deployable in minutes.</p>
    <div class="diff-grid">
      <div class="diff-card">
        <div class="diff-icon">🔒</div>
        <div>
          <h3>Zero content retention</h3>
          <p>File contents and message text are processed in memory and immediately discarded. Only privacy-safe metadata is stored. No training on your data, ever.</p>
        </div>
      </div>
      <div class="diff-card">
        <div class="diff-icon">✅</div>
        <div>
          <h3>Fail-open design</h3>
          <p>Errors and uncertain results never block users. Intentify AI catches leaks without disrupting workflows — your team stays productive.</p>
        </div>
      </div>
      <div class="diff-card">
        <div class="diff-icon">⚡</div>
        <div>
          <h3>Two minutes to deploy</h3>
          <p>One-click Slack install, no agents to deploy, no policies to write. Auto-joins channels and starts protecting immediately.</p>
        </div>
      </div>
      <div class="diff-card">
        <div class="diff-icon">🧠</div>
        <div>
          <h3>AI + Heuristics</h3>
          <p>Two-stage detection: instant regex pre-scan (zero API cost) catches critical patterns, then AI analyzes intent-content alignment for everything else.</p>
        </div>
      </div>
      <div class="diff-card">
        <div class="diff-icon">🏢</div>
        <div>
          <h3>Multi-workspace ready</h3>
          <p>Full OAuth multi-tenant architecture. Each workspace is isolated with its own tokens, settings, and audit trail.</p>
        </div>
      </div>
      <div class="diff-card">
        <div class="diff-icon">📊</div>
        <div>
          <h3>Full visibility</h3>
          <p>Admin dashboard with evaluation history, detection breakdown, risk channels, and monthly summaries. Know exactly what was caught and why.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Technology ── -->
  <section class="section" style="border-top:1px solid #21262d;">
    <div class="section-label">Technology</div>
    <h2 class="section-title">Built on modern, proven infrastructure</h2>
    <p class="section-sub">Open architecture — runs on your own infrastructure, powered by leading AI models.</p>
    <div class="stack-grid">
      <div class="stack-item">
        <div class="stack-icon">🤖</div>
        <div>
          <div class="stack-name">GPT-4o mini</div>
          <div class="stack-desc">Vision + text analysis</div>
        </div>
      </div>
      <div class="stack-item">
        <div class="stack-icon">💬</div>
        <div>
          <div class="stack-name">Slack API</div>
          <div class="stack-desc">OAuth V2 multi-workspace</div>
        </div>
      </div>
      <div class="stack-item">
        <div class="stack-icon">🐘</div>
        <div>
          <div class="stack-name">PostgreSQL 17</div>
          <div class="stack-desc">Tenant-isolated storage</div>
        </div>
      </div>
      <div class="stack-item">
        <div class="stack-icon">🟢</div>
        <div>
          <div class="stack-name">Node.js + Express</div>
          <div class="stack-desc">Lightweight, fast runtime</div>
        </div>
      </div>
      <div class="stack-item">
        <div class="stack-icon">⚡</div>
        <div>
          <div class="stack-name">Pre-scan engine</div>
          <div class="stack-desc">Zero-cost regex heuristics</div>
        </div>
      </div>
      <div class="stack-item">
        <div class="stack-icon">📄</div>
        <div>
          <div class="stack-name">File extractors</div>
          <div class="stack-desc">PDF, DOCX, XLSX, PPTX, CSV</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Roadmap ── -->
  <section class="section" style="border-top:1px solid #21262d;">
    <div class="section-label">Product roadmap</div>
    <h2 class="section-title">What we're building</h2>
    <p class="section-sub">Slack is just the beginning. Here's where Intentify AI is headed.</p>
    <ul class="roadmap-list">
      <li>
        <span class="road-status live">Live</span>
        <div class="road-text">
          <strong>Slack DLP — three-axis file verification</strong>
          <p>Intent × Content × Context analysis for every file share. Includes AI vision, text extraction, and PII pre-scan.</p>
        </div>
      </li>
      <li>
        <span class="road-status live">Live</span>
        <div class="road-text">
          <strong>Multi-workspace OAuth install</strong>
          <p>One-click install, per-workspace token isolation, admin dashboard with Sign in with Slack.</p>
        </div>
      </li>
      <li>
        <span class="road-status soon">Coming soon</span>
        <div class="road-text">
          <strong>Microsoft Teams integration</strong>
          <p>Same three-axis detection for Teams file shares and channels.</p>
        </div>
      </li>
      <li>
        <span class="road-status soon">Coming soon</span>
        <div class="road-text">
          <strong>Email DLP</strong>
          <p>Catch wrong attachments in outbound email before they reach external recipients.</p>
        </div>
      </li>
      <li>
        <span class="road-status planned">Planned</span>
        <div class="road-text">
          <strong>Compliance reporting</strong>
          <p>Export audit logs in CSV/JSON for SOC 2, HIPAA, and GDPR compliance reviews.</p>
        </div>
      </li>
      <li>
        <span class="road-status planned">Planned</span>
        <div class="road-text">
          <strong>Policy engine</strong>
          <p>Define custom rules: block specific file types in specific channels, whitelist trusted users, set escalation workflows.</p>
        </div>
      </li>
    </ul>
  </section>

  <!-- ── CTA ── -->
  <div class="cta">
    <h2>Ready to close the blindspot?</h2>
    <p>One-click Slack install. Zero content retention. No sales call required.</p>
    <div class="cta-actions">
      <a class="btn btn-primary" href="/slack/oauth/install">Add to Slack &mdash; free</a>
      <a class="btn btn-secondary" href="/features">See all features</a>
    </div>
  </div>

  <footer class="footer">
    <div>Intentify AI &mdash; AI-powered Data Loss Prevention for Slack</div>
    <div class="footer-links">
      <a href="/privacy">Privacy Policy</a>
      <a href="/terms">Terms</a>
      <a href="/support">Support</a>
      <a href="/features">Features</a>
      <a href="mailto:hello@intentify.tech">hello@intentify.tech</a>
    </div>
  </footer>

</body>
</html>`);
});

module.exports = router;

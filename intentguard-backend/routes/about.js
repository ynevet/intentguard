const express = require('express');
const crypto = require('crypto');
const { buildNav, buildHead } = require('../lib/nav');
const router = express.Router();

router.get('/', (req, res) => {
  // Returning visitor detection
  const isReturning = !!req.cookies?.ig_visited;
  res.cookie('ig_visited', '1', {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
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

      /* vs-badge stacks vertically */
      .vs-badge { flex-direction: column; align-items: flex-start; gap: 4px; }

      /* Roadmap — status badge above text on very small screens */
      .roadmap-list li { flex-direction: column; gap: 6px; }

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
        <p>What the sender <em>claims</em> the file is.</p>
      </div>
      <div class="axis-cell content">
        <div class="icon">🔍</div>
        <h3>Content</h3>
        <p>What's <em>actually inside</em> — AI vision, text extraction, link-type detection.</p>
      </div>
      <div class="axis-cell context">
        <div class="icon">🌐</div>
        <h3>Context</h3>
        <p>Whether the content is <em>appropriate for this audience</em>.</p>
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
          <p>File contents are processed in memory and immediately discarded. No training on your data, ever.</p>
        </div>
      </div>
      <div class="diff-card">
        <div class="diff-icon">✅</div>
        <div>
          <h3>Fail-open design</h3>
          <p>Errors never block users. Intentify AI catches leaks without disrupting workflows.</p>
        </div>
      </div>
      <div class="diff-card">
        <div class="diff-icon">⚡</div>
        <div>
          <h3>Two minutes to deploy</h3>
          <p>One-click Slack install. No agents, no policies. Auto-joins channels and starts protecting immediately.</p>
        </div>
      </div>
      <div class="diff-card">
        <div class="diff-icon">🧠</div>
        <div>
          <h3>AI + heuristics</h3>
          <p>Instant regex pre-scan catches known patterns at zero cost, then AI verifies intent-content alignment.</p>
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
          <strong>Slack DLP — three-axis verification</strong>
          <p>AI vision, text extraction, PII pre-scan, and shared link detection.</p>
        </div>
      </li>
      <li>
        <span class="road-status live">Live</span>
        <div class="road-text">
          <strong>Multi-workspace install</strong>
          <p>One-click OAuth, per-workspace isolation, admin dashboard.</p>
        </div>
      </li>
      <li>
        <span class="road-status soon">Coming soon</span>
        <div class="road-text">
          <strong>Microsoft Teams</strong>
          <p>Same three-axis detection for Teams channels.</p>
        </div>
      </li>
      <li>
        <span class="road-status soon">Coming soon</span>
        <div class="road-text">
          <strong>Email DLP</strong>
          <p>Catch wrong attachments before they reach external recipients.</p>
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

  <script>
  /* ── UTM attribution cookie ── */
  (function () {
    var params = new URLSearchParams(window.location.search);
    var src = params.get('utm_source');
    if (src) {
      var val = [src, params.get('utm_medium'), params.get('utm_campaign'), params.get('utm_content')].filter(Boolean).join('|');
      var exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = 'ig_utm=' + encodeURIComponent(val) + '; expires=' + exp + '; path=/; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}';
    }
  })();

  /* ── Exit-intent popup ── */
  (function () {
    if (sessionStorage.getItem('ig_exit_shown')) return;
    if (window.innerWidth < 768) return;
    var overlay = document.createElement('div');
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;align-items:center;justify-content:center;';
    var isRet = ${isReturning ? 'true' : 'false'};
    overlay.innerHTML = '<div style="background:#161b22;border:1px solid #30363d;border-radius:16px;padding:40px 36px;max-width:480px;width:90%;text-align:center;position:relative;">' +
      '<button onclick="this.closest(\'[style*=fixed]\').style.display=\'none\'" style="position:absolute;top:14px;right:16px;background:none;border:none;color:#8b949e;font-size:20px;cursor:pointer;line-height:1;">&times;</button>' +
      '<div style="font-size:28px;margin-bottom:16px;">🛡️</div>' +
      '<h2 style="font-size:20px;font-weight:700;margin-bottom:10px;color:#e6edf3;">' + (isRet ? 'Still thinking it over?' : 'Ready to close the blindspot?') + '</h2>' +
      '<p style="font-size:14px;color:#8b949e;margin-bottom:28px;line-height:1.6;">One-click Slack install. No agents, no policies, no credit card. Starts protecting in 2 minutes.</p>' +
      '<a href="/slack/oauth/install" style="display:block;padding:13px 24px;background:#1f6feb;color:#fff;font-size:15px;font-weight:600;border-radius:8px;text-decoration:none;margin-bottom:10px;">Add to Slack &mdash; free</a>' +
      '<a href="/features" style="display:block;padding:11px 24px;background:transparent;color:#8b949e;font-size:14px;border-radius:8px;text-decoration:none;border:1px solid #30363d;">See full features</a>' +
      '<p style="font-size:12px;color:#484f58;margin-top:16px;">Zero content retention &middot; 2-min setup</p>' +
    '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.style.display = 'none'; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') overlay.style.display = 'none'; });
    var triggered = false;
    document.addEventListener('mouseleave', function (e) {
      if (triggered || e.clientY > 20) return;
      triggered = true;
      sessionStorage.setItem('ig_exit_shown', '1');
      overlay.style.display = 'flex';
      try { navigator.sendBeacon('/features/intent', JSON.stringify({ event: 'exit_intent', data: { path: '/about' } })); } catch (_) {}
    });
  })();
  </script>
</body>
</html>`);
});

module.exports = router;

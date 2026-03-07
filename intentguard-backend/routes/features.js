const crypto = require('crypto');
const express = require('express');
const logger = require('../lib/logger');
const { buildNav, buildHead } = require('../lib/nav');
const { saveLead } = require('../lib/db');
const router = express.Router();

// In-memory rate limiting for contact form
const submissions = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT = 3;

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of submissions) {
    if (now - data.windowStart > RATE_WINDOW_MS) submissions.delete(ip);
  }
}, 10 * 60 * 1000);

router.get('/', (req, res) => {
  const thanks = req.query.thanks === '1';
  const rateLimited = req.query.error === 'rate_limit';
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Intentify AI',
      url: 'https://intentify.tech',
      logo: 'https://intentify.tech/public/logo.png',
      description: 'AI-powered data loss prevention for Slack that catches wrong file attachments.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Intentify AI',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: 'AI-powered DLP for Slack — three-axis verification of Intent vs Content vs Context.',
    },
  ];
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  ${buildHead({
    title: 'Intentify AI — Prevent Data Leaks Before They Happen',
    description: 'AI-powered DLP for Slack that catches the #1 cause of data leaks: wrong file attachments. Three-axis verification of Intent vs Content vs Context. Free, zero content retention.',
    path: '/features',
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
    a.btn, button.btn {
      display: inline-block;
      padding: 12px 28px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.18s;
      cursor: pointer;
      border: none;
      font-family: inherit;
    }
    .btn-primary { background: #1f6feb; color: #fff; }
    .btn-primary:hover { background: #388bfd; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(31,111,235,0.35); }
    .btn-secondary { background: transparent; color: #e6edf3; border: 1px solid #30363d; }
    .btn-secondary:hover { background: #21262d; border-color: #484f58; }
    .btn-ghost { background: transparent; color: #8b949e; font-size: 14px; padding: 8px 16px; }
    .btn-ghost:hover { color: #e6edf3; }

    .section { max-width: 1000px; margin: 0 auto; padding: 72px 24px; }
    .section-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #58a6ff; margin-bottom: 12px; }
    .section-title { font-size: 32px; font-weight: 700; margin-bottom: 10px; line-height: 1.25; }
    .section-sub { font-size: 16px; color: #8b949e; margin-bottom: 40px; max-width: 580px; }

    /* ── Hero ── */
    .hero {
      text-align: center;
      padding: 90px 24px 80px;
      background: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(31,111,235,0.12) 0%, transparent 70%), #0d1117;
      border-bottom: 1px solid #21262d;
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.015'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
      pointer-events: none;
    }
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(248,81,73,0.1);
      border: 1px solid rgba(248,81,73,0.25);
      border-radius: 100px;
      padding: 5px 14px;
      font-size: 13px;
      color: #f85149;
      margin-bottom: 24px;
    }
    .hero-badge::before { content: '●'; font-size: 8px; }
    .hero h1 {
      font-size: clamp(32px, 5vw, 52px);
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.5px;
      margin-bottom: 20px;
      max-width: 760px;
      margin-left: auto;
      margin-right: auto;
    }
    .hero h1 em {
      font-style: normal;
      background: linear-gradient(135deg, #58a6ff 0%, #3fb950 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero-sub {
      font-size: 18px;
      color: #8b949e;
      max-width: 560px;
      margin: 0 auto 36px;
      line-height: 1.6;
    }
    .hero-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; align-items: center; margin-bottom: 56px; }
    .hero-actions .note { font-size: 13px; color: #484f58; margin-top: 8px; width: 100%; }
    .hero-video {
      max-width: 780px;
      margin: 0 auto;
    }
    .video-container {
      position: relative;
      padding-bottom: 56.25%;
      height: 0;
      overflow: hidden;
      border-radius: 12px;
      border: 1px solid #21262d;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    .video-container iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }

    /* ── Proof bar ── */
    .proof-bar {
      border-top: 1px solid #21262d;
      border-bottom: 1px solid #21262d;
      background: #0d1117;
      padding: 20px 24px;
    }
    .proof-bar-inner {
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 40px;
      flex-wrap: wrap;
    }
    .proof-stat { text-align: center; }
    .proof-stat .num { font-size: 26px; font-weight: 800; color: #e6edf3; }
    .proof-stat .lbl { font-size: 12px; color: #484f58; margin-top: 2px; }
    .proof-divider { width: 1px; height: 40px; background: #21262d; }
    @media (max-width: 600px) { .proof-divider { display: none; } }

    /* ── Problem ── */
    .problem-split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #21262d;
    }
    @media (max-width: 680px) { .problem-split { grid-template-columns: 1fr; } }
    .problem-col {
      background: #161b22;
      padding: 32px 28px;
    }
    .problem-col + .problem-col { border-left: 1px solid #21262d; }
    @media (max-width: 680px) { .problem-col + .problem-col { border-left: none; border-top: 1px solid #21262d; } }
    .problem-col-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 16px;
    }
    .problem-col-label.bad { color: #484f58; }
    .problem-col-label.good { color: #3fb950; }
    .problem-col ul { list-style: none; padding: 0; }
    .problem-col ul li {
      font-size: 14px;
      color: #c9d1d9;
      padding: 7px 0 7px 26px;
      position: relative;
      border-bottom: 1px solid #21262d;
    }
    .problem-col ul li:last-child { border-bottom: none; }
    .problem-col ul li::before { position: absolute; left: 0; font-size: 13px; }
    .problem-col.bad ul li::before { content: '✓'; color: #484f58; }
    .problem-col.good ul li::before { content: '✓'; color: #3fb950; }

    /* ── Scenarios (chat-style mockups) ── */
    .scenarios-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
      gap: 16px;
    }
    .scenario-card {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      overflow: hidden;
    }
    .scenario-card-head {
      padding: 10px 16px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid #21262d;
    }
    .scenario-card-head.caught { background: rgba(248,81,73,0.08); color: #f85149; }
    .scenario-card-head.safe { background: rgba(63,185,80,0.08); color: #3fb950; }
    .scenario-card-head .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .scenario-card-body { padding: 16px; }
    .chat-bubble {
      background: #21262d;
      border-radius: 8px 8px 8px 2px;
      padding: 10px 14px;
      font-size: 13px;
      color: #e6edf3;
      margin-bottom: 10px;
      line-height: 1.4;
    }
    .chat-bubble .attachment {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      padding: 7px 10px;
      background: #0d1117;
      border-radius: 6px;
      font-size: 12px;
      color: #8b949e;
    }
    .chat-bubble .attachment .icon { font-size: 16px; }
    .verdict {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 13px;
    }
    .verdict.blocked { background: rgba(248,81,73,0.08); border: 1px solid rgba(248,81,73,0.2); color: #f85149; }
    .verdict.allowed { background: rgba(63,185,80,0.08); border: 1px solid rgba(63,185,80,0.2); color: #3fb950; }
    .verdict-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
    .verdict-text { line-height: 1.4; }

    /* ── 3-Axis ── */
    .axes-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    @media (max-width: 680px) { .axes-grid { grid-template-columns: 1fr; } }
    .axis-card {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 28px 24px;
      position: relative;
    }
    .axis-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      border-radius: 12px 12px 0 0;
    }
    .axis-card.intent::before { background: linear-gradient(90deg, #58a6ff, #1f6feb); }
    .axis-card.content::before { background: linear-gradient(90deg, #3fb950, #2ea043); }
    .axis-card.context::before { background: linear-gradient(90deg, #d2a8ff, #a371f7); }
    .axis-card .icon { font-size: 28px; margin-bottom: 14px; }
    .axis-card h3 { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
    .axis-card p { font-size: 14px; color: #8b949e; line-height: 1.5; }

    /* Pipeline flow */
    .pipeline {
      display: flex;
      align-items: stretch;
      gap: 0;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #21262d;
    }
    @media (max-width: 720px) {
      .pipeline { flex-direction: column; }
      .pipeline-arrow { display: none; }
    }
    .pipeline-step {
      flex: 1;
      background: #161b22;
      padding: 20px 18px;
      text-align: center;
    }
    .pipeline-step + .pipeline-step { border-left: 1px solid #21262d; }
    @media (max-width: 720px) { .pipeline-step + .pipeline-step { border-left: none; border-top: 1px solid #21262d; } }
    .pipeline-step .step-num { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #484f58; margin-bottom: 6px; }
    .pipeline-step .step-icon { font-size: 22px; margin-bottom: 6px; }
    .pipeline-step .step-name { font-size: 13px; font-weight: 600; color: #c9d1d9; margin-bottom: 4px; }
    .pipeline-step .step-desc { font-size: 12px; color: #484f58; line-height: 1.4; }
    .pipeline-step.outcome { background: rgba(31,111,235,0.06); }
    .pipeline-step.outcome .step-num { color: #1f6feb; }

    /* ── Privacy ── */
    .privacy-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    @media (max-width: 640px) { .privacy-grid { grid-template-columns: 1fr; } }
    .privacy-card {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }
    .privacy-icon {
      font-size: 24px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .privacy-card h3 { font-size: 15px; font-weight: 600; margin-bottom: 5px; }
    .privacy-card p { font-size: 13px; color: #8b949e; line-height: 1.5; }

    /* ── Comparison ── */
    .comparison-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid #21262d; }
    .comparison { width: 100%; border-collapse: collapse; font-size: 14px; }
    .comparison th, .comparison td { padding: 13px 18px; text-align: left; border-bottom: 1px solid #21262d; }
    .comparison thead th { background: #161b22; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #8b949e; }
    .comparison thead th:first-child { color: #484f58; }
    .comparison thead th:nth-child(2) { color: #58a6ff; }
    .comparison tbody tr:last-child td { border-bottom: none; }
    .comparison tbody tr:hover td { background: rgba(255,255,255,0.02); }
    .comparison td { color: #c9d1d9; }
    .comparison td:first-child { color: #8b949e; font-size: 13px; }
    .comparison .yes { color: #3fb950; font-size: 16px; }
    .comparison .no { color: #30363d; font-size: 16px; }
    .comparison .highlight { color: #58a6ff; font-weight: 600; }

    /* ── Pricing ── */
    .pricing-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 640px) { .pricing-grid { grid-template-columns: 1fr; } }
    .pricing-card {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 32px 28px;
      position: relative;
    }
    .pricing-card.featured {
      border-color: #1f6feb;
      background: linear-gradient(180deg, rgba(31,111,235,0.06) 0%, #161b22 60%);
    }
    .pricing-badge {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: #1f6feb;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      padding: 3px 12px;
      border-radius: 100px;
      white-space: nowrap;
    }
    .pricing-name { font-size: 14px; font-weight: 600; color: #8b949e; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .pricing-price { font-size: 40px; font-weight: 800; margin-bottom: 4px; }
    .pricing-price .sup { font-size: 20px; vertical-align: super; font-weight: 600; }
    .pricing-note { font-size: 13px; color: #484f58; margin-bottom: 24px; }
    .pricing-card ul { list-style: none; padding: 0; margin-bottom: 28px; }
    .pricing-card ul li {
      font-size: 14px;
      color: #c9d1d9;
      padding: 6px 0 6px 22px;
      position: relative;
    }
    .pricing-card ul li::before { content: '✓'; position: absolute; left: 0; color: #3fb950; font-size: 13px; }
    .pricing-card .btn { width: 100%; text-align: center; }
    .pricing-footnote { font-size: 12px; color: #484f58; text-align: center; margin-top: 16px; }

    /* ── Contact ── */
    .contact-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 48px;
      align-items: start;
    }
    @media (max-width: 680px) { .contact-grid { grid-template-columns: 1fr; gap: 32px; } }
    .contact-info h3 { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
    .contact-info p { font-size: 15px; color: #8b949e; line-height: 1.6; margin-bottom: 24px; }
    .contact-points { list-style: none; padding: 0; }
    .contact-points li { font-size: 14px; color: #8b949e; padding: 5px 0 5px 24px; position: relative; }
    .contact-points li::before { content: '→'; position: absolute; left: 0; color: #1f6feb; }
    .form-group { margin-bottom: 14px; }
    .form-group label { display: block; font-size: 13px; color: #8b949e; margin-bottom: 5px; font-weight: 500; }
    .form-group input, .form-group textarea {
      width: 100%; padding: 10px 12px;
      background: #0d1117;
      border: 1px solid #21262d;
      border-radius: 7px;
      color: #e6edf3;
      font-size: 14px;
      font-family: inherit;
      transition: border-color 0.15s;
    }
    .form-group input:focus, .form-group textarea:focus { outline: none; border-color: #388bfd; }
    .form-group textarea { resize: vertical; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 480px) { .form-row { grid-template-columns: 1fr; } }

    /* ── CTA ── */
    .cta {
      text-align: center;
      padding: 80px 24px;
      background: radial-gradient(ellipse 60% 80% at 50% 0%, rgba(31,111,235,0.1) 0%, transparent 70%);
      border-top: 1px solid #21262d;
    }
    .cta h2 { font-size: 36px; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.3px; }
    .cta p { font-size: 16px; color: #8b949e; margin-bottom: 32px; }
    .cta-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

    /* ── Footer ── */
    .footer {
      text-align: center;
      padding: 28px 24px;
      font-size: 13px;
      color: #484f58;
      border-top: 1px solid #21262d;
    }
    .footer a { color: #484f58; text-decoration: none; }
    .footer a:hover { color: #8b949e; }
    .footer-links { margin-top: 8px; display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
  </style>
</head>
<body>

  ${buildNav('features', req.session)}

  ${rateLimited ? '<div style="background:#da3633;color:#fff;padding:12px 24px;text-align:center;font-size:14px;">Too many submissions. Please try again later.</div>' : ''}

  <!-- ── Hero ── -->
  <section class="hero">
    <div class="hero-badge">68% of breaches involve a human element — Verizon DBIR 2024</div>
    <h1>Your DLP misses the<br><em>most common data leak</em></h1>
    <p class="hero-sub">Wrong file attachments cause more data incidents than phishing and malware combined. Intentify AI catches them in Slack before they leave.</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="/slack/oauth/install">Add to Slack &mdash; free</a>
      <a class="btn btn-secondary" href="#how-it-works">See how it works ↓</a>
      <span class="note">2-minute setup &middot; Zero content retention &middot; No credit card</span>
    </div>
    <div class="hero-video">
      <div class="video-container">
        <iframe src="https://www.youtube.com/embed/R6s9ju1yZ6M" title="Intentify AI Slack Bot Demo" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
    </div>
  </section>

  <!-- ── Proof bar ── -->
  <div class="proof-bar">
    <div class="proof-bar-inner">
      <div class="proof-stat">
        <div class="num">$4.88M</div>
        <div class="lbl">avg. cost of a breach</div>
      </div>
      <div class="proof-divider"></div>
      <div class="proof-stat">
        <div class="num">68%</div>
        <div class="lbl">breaches: human element</div>
      </div>
      <div class="proof-divider"></div>
      <div class="proof-stat">
        <div class="num">#1</div>
        <div class="lbl">cause: wrong file sent</div>
      </div>
      <div class="proof-divider"></div>
      <div class="proof-stat">
        <div class="num">2 min</div>
        <div class="lbl">to deploy</div>
      </div>
    </div>
  </div>

  <!-- ── The Blindspot ── -->
  <section class="section">
    <div class="section-label">The Problem</div>
    <h2 class="section-title">Traditional DLP has a fatal blindspot</h2>
    <p class="section-sub">Pattern matching catches SSNs and credit cards. It cannot catch someone attaching the wrong file — the most common incident of all.</p>
    <div class="problem-split">
      <div class="problem-col bad">
        <div class="problem-col-label bad">Traditional DLP catches</div>
        <ul>
          <li>Social Security numbers</li>
          <li>Credit card numbers</li>
          <li>Regex keyword patterns</li>
          <li>Known file signatures</li>
        </ul>
      </div>
      <div class="problem-col good">
        <div class="problem-col-label good">Intentify AI also catches</div>
        <ul>
          <li>Wrong file attached to a message</li>
          <li>"Anonymized" docs with raw PII</li>
          <li>Confidential data in public channels</li>
          <li>Internal docs in Slack Connect channels</li>
          <li>Sensitive screenshots and images</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- ── Scenarios ── -->
  <section class="section" style="padding-top:0;">
    <div class="section-label">Real-world scenarios</div>
    <h2 class="section-title">Leaks Intentify AI prevents every day</h2>
    <p class="section-sub">Every scenario below is invisible to traditional DLP tools.</p>
    <div class="scenarios-grid">

      <div class="scenario-card">
        <div class="scenario-card-head caught"><span class="dot"></span>Mismatch — blocked</div>
        <div class="scenario-card-body">
          <div class="chat-bubble">
            Here are the demo slides for the sales call.
            <div class="attachment"><span class="icon">📄</span> Q1_Financial_Results_FINAL.pdf</div>
          </div>
          <div class="verdict blocked">
            <span class="verdict-icon">🛑</span>
            <span class="verdict-text">File removed. File contains Q1 revenue figures — doesn't match "demo slides". DM sent to sender.</span>
          </div>
        </div>
      </div>

      <div class="scenario-card">
        <div class="scenario-card-head caught"><span class="dot"></span>PII leak — blocked</div>
        <div class="scenario-card-body">
          <div class="chat-bubble">
            Sharing the anonymized customer report.
            <div class="attachment"><span class="icon">📊</span> customer_report_anon.xlsx</div>
          </div>
          <div class="verdict blocked">
            <span class="verdict-icon">🛑</span>
            <span class="verdict-text">File removed. Spreadsheet contains raw email addresses and customer names. Not anonymized.</span>
          </div>
        </div>
      </div>

      <div class="scenario-card">
        <div class="scenario-card-head caught"><span class="dot"></span>Context violation — blocked</div>
        <div class="scenario-card-body">
          <div class="chat-bubble">
            Updated revenue forecast for Q2.
            <div class="attachment"><span class="icon">📈</span> revenue_forecast_q2.xlsx</div>
          </div>
          <div class="verdict blocked">
            <span class="verdict-icon">🛑</span>
            <span class="verdict-text">File removed. Confidential financial data shared in #general (public channel, 280 members).</span>
          </div>
        </div>
      </div>

      <div class="scenario-card">
        <div class="scenario-card-head caught"><span class="dot"></span>External leak — blocked</div>
        <div class="scenario-card-body">
          <div class="chat-bubble">
            Here's the project status update.
            <div class="attachment"><span class="icon">📝</span> Product_Roadmap_2025.pptx</div>
          </div>
          <div class="verdict blocked">
            <span class="verdict-icon">🛑</span>
            <span class="verdict-text">File removed. Internal roadmap shared in a Slack Connect channel with external partners.</span>
          </div>
        </div>
      </div>

      <div class="scenario-card">
        <div class="scenario-card-head safe"><span class="dot"></span>Verified safe</div>
        <div class="scenario-card-body">
          <div class="chat-bubble">
            Invoice attached for last month.
            <div class="attachment"><span class="icon">🧾</span> invoice_march_2025.pdf</div>
          </div>
          <div class="verdict allowed">
            <span class="verdict-icon">✅</span>
            <span class="verdict-text">Verified. Invoice content matches description, shared in private #finance channel.</span>
          </div>
        </div>
      </div>

      <div class="scenario-card">
        <div class="scenario-card-head safe"><span class="dot"></span>Verified safe</div>
        <div class="scenario-card-body">
          <div class="chat-bubble">
            New logo variants for review.
            <div class="attachment"><span class="icon">🖼️</span> logo_v3_variants.png</div>
          </div>
          <div class="verdict allowed">
            <span class="verdict-icon">✅</span>
            <span class="verdict-text">Verified. Image shows logo variants, shared in #design. No sensitive content.</span>
          </div>
        </div>
      </div>

    </div>
  </section>

  <!-- ── How it works ── -->
  <section class="section" id="how-it-works" style="border-top:1px solid #21262d;">
    <div class="section-label">How it works</div>
    <h2 class="section-title">Three-axis verification, every message</h2>
    <p class="section-sub">Intentify AI checks intent, content, and context simultaneously. Verdict in seconds, fully automated.</p>

    <div class="axes-grid">
      <div class="axis-card intent">
        <div class="icon">💬</div>
        <h3>Intent</h3>
        <p>What the user <em>says</em> the file is. We parse the message to understand the sender's stated purpose and expected content type.</p>
      </div>
      <div class="axis-card content">
        <div class="icon">🔍</div>
        <h3>Content</h3>
        <p>What's <em>actually inside</em> the file. AI vision for images and screenshots; text extraction for PDFs, DOCX, XLSX, PPTX, and CSV.</p>
      </div>
      <div class="axis-card context">
        <div class="icon">🌐</div>
        <h3>Context</h3>
        <p>Whether the content is <em>appropriate for the audience</em>. Channel type, member count, external guests, and sensitivity level.</p>
      </div>
    </div>

    <div class="pipeline">
      <div class="pipeline-step">
        <div class="step-num">Step 1</div>
        <div class="step-icon">📤</div>
        <div class="step-name">Message sent</div>
        <div class="step-desc">User shares file in Slack</div>
      </div>
      <div class="pipeline-step">
        <div class="step-num">Step 2</div>
        <div class="step-icon">⚡</div>
        <div class="step-name">Pre-scan</div>
        <div class="step-desc">Instant regex for CC, SSN, API keys</div>
      </div>
      <div class="pipeline-step">
        <div class="step-num">Step 3</div>
        <div class="step-icon">🧠</div>
        <div class="step-name">AI analysis</div>
        <div class="step-desc">Intent × Content × Context</div>
      </div>
      <div class="pipeline-step">
        <div class="step-num">Step 4</div>
        <div class="step-icon">⚖️</div>
        <div class="step-name">Verdict</div>
        <div class="step-desc">Match, mismatch, or uncertain</div>
      </div>
      <div class="pipeline-step outcome">
        <div class="step-num">Mismatch</div>
        <div class="step-icon">🛑</div>
        <div class="step-name">File removed</div>
        <div class="step-desc">DM sent · re-send prompt</div>
      </div>
    </div>
  </section>

  <!-- ── Privacy ── -->
  <section class="section" style="border-top:1px solid #21262d;">
    <div class="section-label">Privacy & Security</div>
    <h2 class="section-title">Built privacy-first from day one</h2>
    <p class="section-sub">Enterprise DLP without the enterprise data risk. Your files never leave the analysis pipeline.</p>
    <div class="privacy-grid">
      <div class="privacy-card">
        <div class="privacy-icon">🔒</div>
        <div>
          <h3>Zero content retention</h3>
          <p>File contents and message text are processed in-memory and immediately discarded. Only privacy-safe metadata (labels, scores) is stored. Never used for model training.</p>
        </div>
      </div>
      <div class="privacy-card">
        <div class="privacy-icon">✅</div>
        <div>
          <h3>Fail-open design</h3>
          <p>Errors and uncertain results never block users. If the AI is unsure or a request fails, the file passes through. Zero workflow disruption.</p>
        </div>
      </div>
      <div class="privacy-card">
        <div class="privacy-icon">🏢</div>
        <div>
          <h3>Workspace isolation</h3>
          <p>Each workspace's data is fully isolated. Analysis requests are stateless with no cross-workspace data exposure.</p>
        </div>
      </div>
      <div class="privacy-card">
        <div class="privacy-icon">🔍</div>
        <div>
          <h3>Full audit trail</h3>
          <p>Every verdict is logged to your admin dashboard. Review evaluations, tune thresholds, and export compliance reports.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Comparison ── -->
  <section class="section" style="border-top:1px solid #21262d;">
    <div class="section-label">Comparison</div>
    <h2 class="section-title">Intentify AI vs Traditional DLP</h2>
    <p class="section-sub">Not a replacement — a critical layer traditional DLP cannot provide.</p>
    <div class="comparison-wrap">
      <table class="comparison">
        <thead>
          <tr>
            <th>Capability</th>
            <th>Intentify AI</th>
            <th>Traditional DLP</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Setup time</td><td class="highlight">2 minutes</td><td>Days to weeks</td></tr>
          <tr><td>Intent vs content verification</td><td class="yes">✓</td><td class="no">✗</td></tr>
          <tr><td>PII pattern matching (CC, SSN, API keys)</td><td class="yes">✓</td><td class="yes">✓</td></tr>
          <tr><td>AI vision for images &amp; screenshots</td><td class="yes">✓</td><td class="no">✗</td></tr>
          <tr><td>Channel audience awareness</td><td class="yes">✓</td><td class="no">✗</td></tr>
          <tr><td>Slack Connect / external guest detection</td><td class="yes">✓</td><td class="no">✗</td></tr>
          <tr><td>Content retained after analysis</td><td class="highlight">Never</td><td>Stored</td></tr>
          <tr><td>Agent or policy deployment required</td><td class="highlight">None</td><td>Required</td></tr>
          <tr><td>Auth</td><td class="highlight">Sign in with Slack</td><td>Separate portal</td></tr>
          <tr><td>Pricing</td><td class="highlight">Free</td><td>Per-seat licensing</td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- ── Pricing ── -->
  <section class="section" style="border-top:1px solid #21262d;">
    <div class="section-label">Pricing</div>
    <h2 class="section-title">Simple pricing. No per-seat fees.</h2>
    <p class="section-sub">You own your infrastructure. You only pay for your OpenAI API usage.</p>
    <div class="pricing-grid">
      <div class="pricing-card featured">
        <div class="pricing-badge">Available now</div>
        <div class="pricing-name">Community</div>
        <div class="pricing-price">Free</div>
        <div class="pricing-note">Self-hosted, forever</div>
        <ul>
          <li>All detection features</li>
          <li>Unlimited workspaces</li>
          <li>Admin dashboard</li>
          <li>Evaluation history</li>
          <li>90-day retention</li>
          <li>Community support</li>
        </ul>
        <a class="btn btn-primary" href="/slack/oauth/install">Add to Slack</a>
      </div>
      <div class="pricing-card">
        <div class="pricing-name">Pro</div>
        <div class="pricing-price">Coming soon</div>
        <div class="pricing-note">Everything in Community, plus:</div>
        <ul>
          <li>Priority support &amp; SLA</li>
          <li>Custom retention policies</li>
          <li>Audit log export (CSV/JSON)</li>
          <li>Dedicated onboarding</li>
          <li>Custom alert thresholds</li>
          <li>Compliance reports</li>
        </ul>
        <a class="btn btn-secondary" href="mailto:sales@intentify.tech">Join waitlist</a>
      </div>
    </div>
    <p class="pricing-footnote">Intentify AI is self-hosted. Typical OpenAI API cost: $0.002–$0.01 per file scanned.</p>
  </section>

  <!-- ── Contact ── -->
  <section class="section" style="border-top:1px solid #21262d;">
    ${thanks ? `
    <div class="section-label">Thank you</div>
    <h2 class="section-title">We'll be in touch!</h2>
    <p class="section-sub">We received your message and will respond within one business day.</p>
    <a class="btn btn-secondary" href="/features">← Back</a>
    ` : `
    <div class="contact-grid">
      <div class="contact-info">
        <div class="section-label">Get in touch</div>
        <h3>Interested in Intentify AI for your team?</h3>
        <p>Leave your details and we'll reach out within one business day. No sales pressure, no demo calls required.</p>
        <ul class="contact-points">
          <li>Questions about deployment and self-hosting</li>
          <li>Enterprise pricing and support SLA</li>
          <li>Security review and compliance docs</li>
          <li>Custom integration requirements</li>
        </ul>
      </div>
      <div>
        <form method="POST" action="/features/contact">
          <div class="form-row">
            <div class="form-group">
              <label for="name">Name *</label>
              <input type="text" id="name" name="name" required maxlength="100" placeholder="Your name">
            </div>
            <div class="form-group">
              <label for="email">Work email *</label>
              <input type="email" id="email" name="email" required maxlength="200" placeholder="you@company.com">
            </div>
          </div>
          <div class="form-group">
            <label for="company">Company</label>
            <input type="text" id="company" name="company" maxlength="200" placeholder="Your company">
          </div>
          <div class="form-group">
            <label for="message">Message</label>
            <textarea id="message" name="message" maxlength="1000" rows="4" placeholder="Tell us about your use case..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Send message</button>
        </form>
      </div>
    </div>
    `}
  </section>

  <!-- ── CTA ── -->
  <div class="cta">
    <h2>Stop leaks before they happen</h2>
    <p>One-click install. Protects your workspace in minutes. No sales call, no credit card.</p>
    <div class="cta-actions">
      <a class="btn btn-primary" href="/slack/oauth/install">Add to Slack &mdash; free</a>
      <a class="btn btn-secondary" href="/about">Learn more →</a>
    </div>
  </div>

  <footer class="footer">
    <div>Intentify AI &mdash; AI-powered Data Loss Prevention for Slack</div>
    <div class="footer-links">
      <a href="/privacy">Privacy Policy</a>
      <a href="/terms">Terms</a>
      <a href="/support">Support</a>
      <a href="/about">About</a>
      <a href="mailto:hello@intentify.tech">hello@intentify.tech</a>
    </div>
  </footer>

</body>
</html>`);
});

router.post('/contact', express.urlencoded({ extended: false }), async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress || 'unknown';

  // Rate limiting
  const now = Date.now();
  const entry = submissions.get(ip);
  if (entry && now - entry.windowStart < RATE_WINDOW_MS) {
    if (entry.count >= RATE_LIMIT) {
      return res.redirect('/features?error=rate_limit');
    }
    entry.count++;
  } else {
    submissions.set(ip, { count: 1, windowStart: now });
  }

  const { name, email, company, message } = req.body;

  // Validation
  if (!name || !email || typeof name !== 'string' || typeof email !== 'string') {
    return res.redirect('/features');
  }
  if (name.length > 100 || email.length > 200) {
    return res.redirect('/features');
  }
  if (company && String(company).length > 200) {
    return res.redirect('/features');
  }
  if (message && String(message).length > 1000) {
    return res.redirect('/features');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.redirect('/features');
  }

  const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

  try {
    await saveLead({ name: name.trim(), email: email.trim(), company: company?.trim(), message: message?.trim(), ipHash, source: 'features' });
  } catch (err) {
    logger.error({ err }, 'Failed to save lead');
  }

  res.redirect('/features?thanks=1');
});

module.exports = router;

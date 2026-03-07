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

    .section { max-width: 1000px; margin: 0 auto; padding: 72px 24px; }
    .section-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #58a6ff; margin-bottom: 12px; }
    .section-title { font-size: 32px; font-weight: 700; margin-bottom: 10px; line-height: 1.25; }
    .section-sub { font-size: 16px; color: #8b949e; margin-bottom: 40px; max-width: 580px; }

    /* ══════════════════════════════════════════
       KEYFRAMES
    ══════════════════════════════════════════ */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse-red {
      0%, 100% { box-shadow: 0 0 0 0 rgba(248,81,73,0); }
      50%       { box-shadow: 0 0 0 6px rgba(248,81,73,0.18); }
    }
    @keyframes pulse-green {
      0%, 100% { box-shadow: 0 0 0 0 rgba(63,185,80,0); }
      50%       { box-shadow: 0 0 0 6px rgba(63,185,80,0.18); }
    }
    @keyframes scan-line {
      0%   { top: 0; opacity: 0.6; }
      100% { top: 100%; opacity: 0; }
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0; }
    }
    @keyframes dot-walk {
      0%   { background: #58a6ff; box-shadow: 0 0 6px #58a6ff; }
      20%  { background: #58a6ff; box-shadow: 0 0 6px #58a6ff; }
      21%  { background: #21262d; box-shadow: none; }
      100% { background: #21262d; box-shadow: none; }
    }
    @keyframes glitch {
      0%  { transform: translate(0,0); }
      20% { transform: translate(-2px, 1px); clip-path: inset(20% 0 60% 0); }
      40% { transform: translate(2px,-1px); clip-path: inset(60% 0 10% 0); }
      60% { transform: translate(0, 0); clip-path: none; }
      100%{ transform: translate(0,0); }
    }
    @keyframes grid-scroll {
      from { background-position: 0 0; }
      to   { background-position: 0 40px; }
    }
    @keyframes border-run {
      0%   { background-position: 0% 50%; }
      100% { background-position: 200% 50%; }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50%       { transform: translateY(-6px); }
    }
    @keyframes typewriter {
      from { width: 0; }
      to   { width: 100%; }
    }
    @keyframes threat-slide-in {
      from { opacity: 0; transform: translateX(24px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes threat-fade-out {
      from { opacity: 1; transform: translateX(0); }
      to   { opacity: 0; transform: translateX(-24px); }
    }
    @keyframes count-up-flash {
      0%   { color: #f85149; }
      100% { color: #e6edf3; }
    }

    /* ══════════════════════════════════════════
       HERO
    ══════════════════════════════════════════ */
    .hero {
      text-align: center;
      padding: 80px 24px 60px;
      background: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(31,111,235,0.14) 0%, transparent 70%), #0d1117;
      border-bottom: 1px solid #21262d;
      position: relative;
      overflow: hidden;
    }
    /* animated grid background */
    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(88,166,255,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(88,166,255,0.04) 1px, transparent 1px);
      background-size: 40px 40px;
      animation: grid-scroll 4s linear infinite;
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
      animation: fadeUp 0.6s ease both;
    }
    .hero-badge::before { content: '●'; font-size: 8px; animation: blink 1.8s ease infinite; }
    .hero h1 {
      font-size: clamp(32px, 5vw, 52px);
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.5px;
      margin-bottom: 20px;
      max-width: 760px;
      margin-left: auto;
      margin-right: auto;
      animation: fadeUp 0.6s ease 0.1s both;
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
      animation: fadeUp 0.6s ease 0.2s both;
    }
    .hero-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
      align-items: center;
      margin-bottom: 56px;
      animation: fadeUp 0.6s ease 0.3s both;
    }
    .hero-actions .note { font-size: 13px; color: #484f58; margin-top: 8px; width: 100%; }

    /* ── Live threat feed (replaces static video in hero) ── */
    .threat-feed-wrap {
      max-width: 780px;
      margin: 0 auto;
      animation: fadeUp 0.8s ease 0.4s both;
    }
    .threat-feed-shell {
      background: #0a0e14;
      border: 1px solid #21262d;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(88,166,255,0.05);
      position: relative;
    }
    /* animated border glow */
    .threat-feed-shell::before {
      content: '';
      position: absolute;
      inset: -1px;
      border-radius: 13px;
      background: linear-gradient(90deg, transparent, rgba(88,166,255,0.15), rgba(63,185,80,0.1), transparent);
      background-size: 200% 100%;
      animation: border-run 3s linear infinite;
      pointer-events: none;
      z-index: 0;
    }
    .threat-feed-header {
      position: relative;
      z-index: 1;
      background: #161b22;
      border-bottom: 1px solid #21262d;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .tf-dots { display: flex; gap: 6px; }
    .tf-dot { width: 10px; height: 10px; border-radius: 50%; }
    .tf-dot.r { background: #ff5f57; }
    .tf-dot.y { background: #febc2e; }
    .tf-dot.g { background: #28c840; }
    .tf-title { font-size: 12px; color: #484f58; font-family: 'SF Mono', 'Fira Code', monospace; margin-left: 4px; }
    .tf-live {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 700;
      color: #3fb950;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .tf-live::before {
      content: '';
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #3fb950;
      animation: blink 1.2s ease infinite;
    }
    .threat-feed-body {
      position: relative;
      z-index: 1;
      padding: 0;
      min-height: 280px;
      display: flex;
      flex-direction: column;
    }
    /* scan line animation */
    .threat-feed-body::after {
      content: '';
      position: absolute;
      left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(88,166,255,0.3), transparent);
      animation: scan-line 2.5s linear infinite;
      pointer-events: none;
    }
    .tf-event {
      display: none;
      padding: 20px 20px 4px;
      flex: 1;
    }
    .tf-event.active { display: flex; flex-direction: column; gap: 12px; }
    .tf-event.entering { animation: threat-slide-in 0.4s ease both; }
    .tf-event.leaving  { animation: threat-fade-out 0.3s ease both; }

    .tf-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      font-family: 'SF Mono', 'Fira Code', monospace;
      color: #484f58;
    }
    .tf-meta .channel {
      color: #58a6ff;
      font-weight: 600;
    }
    .tf-meta .user { color: #8b949e; }
    .tf-meta .ts { margin-left: auto; }

    .tf-message {
      background: #21262d;
      border-radius: 8px 8px 8px 2px;
      padding: 12px 16px;
      font-size: 14px;
      color: #e6edf3;
      line-height: 1.5;
      position: relative;
    }
    .tf-file {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 10px;
      padding: 8px 12px;
      background: #0d1117;
      border-radius: 6px;
      border: 1px solid #21262d;
    }
    .tf-file-icon { font-size: 18px; }
    .tf-file-name { font-size: 13px; color: #8b949e; font-family: 'SF Mono', 'Fira Code', monospace; }

    /* analysis steps */
    .tf-analysis {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      font-family: 'SF Mono', 'Fira Code', monospace;
      padding: 0 4px;
    }
    .tf-step {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #484f58;
      opacity: 0;
      transform: translateX(8px);
      transition: opacity 0.3s ease, transform 0.3s ease, color 0.3s ease;
    }
    .tf-step.done { opacity: 1; transform: translateX(0); }
    .tf-step .step-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #21262d;
      flex-shrink: 0;
      transition: background 0.3s, box-shadow 0.3s;
    }
    .tf-step.done .step-dot { background: #58a6ff; box-shadow: 0 0 6px rgba(88,166,255,0.5); }
    .tf-step.done.ok .step-dot { background: #3fb950; box-shadow: 0 0 6px rgba(63,185,80,0.5); }
    .tf-step.done.warn .step-dot { background: #f85149; box-shadow: 0 0 6px rgba(248,81,73,0.5); }
    .tf-step .step-label { flex: 1; }
    .tf-step .step-val { color: #8b949e; }
    .tf-step.done .step-val { color: #e6edf3; }
    .tf-step.done.ok .step-label, .tf-step.done.ok .step-val { color: #3fb950; }
    .tf-step.done.warn .step-label, .tf-step.done.warn .step-val { color: #f85149; }

    /* verdict bar */
    .tf-verdict {
      margin: 4px 0 16px;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 0.4s ease, transform 0.4s ease;
    }
    .tf-verdict.show { opacity: 1; transform: translateY(0); }
    .tf-verdict.blocked {
      background: rgba(248,81,73,0.1);
      border: 1px solid rgba(248,81,73,0.3);
      color: #f85149;
      animation: pulse-red 2s ease infinite;
    }
    .tf-verdict.allowed {
      background: rgba(63,185,80,0.1);
      border: 1px solid rgba(63,185,80,0.3);
      color: #3fb950;
      animation: pulse-green 2s ease infinite;
    }
    .tf-verdict-icon { font-size: 18px; }
    .tf-verdict-text { line-height: 1.4; font-size: 13px; font-weight: 400; }
    .tf-verdict-text strong { font-weight: 700; }

    /* progress bar at bottom of feed */
    .tf-progress {
      height: 2px;
      background: #21262d;
      position: relative;
      overflow: hidden;
    }
    .tf-progress-bar {
      position: absolute;
      left: 0; top: 0; bottom: 0;
      background: linear-gradient(90deg, #58a6ff, #3fb950);
      width: 0%;
      transition: width linear;
    }

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
    .problem-col { background: #161b22; padding: 32px 28px; }
    .problem-col + .problem-col { border-left: 1px solid #21262d; }
    @media (max-width: 680px) { .problem-col + .problem-col { border-left: none; border-top: 1px solid #21262d; } }
    .problem-col-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
    .problem-col-label.bad { color: #484f58; }
    .problem-col-label.good { color: #3fb950; }
    .problem-col ul { list-style: none; padding: 0; }
    .problem-col ul li { font-size: 14px; color: #c9d1d9; padding: 7px 0 7px 26px; position: relative; border-bottom: 1px solid #21262d; }
    .problem-col ul li:last-child { border-bottom: none; }
    .problem-col ul li::before { position: absolute; left: 0; font-size: 13px; }
    .problem-col.bad ul li::before { content: '✓'; color: #484f58; }
    .problem-col.good ul li::before { content: '✓'; color: #3fb950; }

    /* ══════════════════════════════════════════
       LIVE DEMO SECTION — auto-cycling cards
    ══════════════════════════════════════════ */
    .demo-section { background: #0a0e14; border-top: 1px solid #21262d; border-bottom: 1px solid #21262d; }
    .demo-inner { max-width: 1000px; margin: 0 auto; padding: 72px 24px; }
    .demo-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      align-items: start;
    }
    @media (max-width: 720px) { .demo-layout { grid-template-columns: 1fr; } }
    .demo-queue {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .demo-queue-item {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 10px;
      padding: 12px 14px;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
    }
    .demo-queue-item:hover { border-color: #30363d; background: #1c2128; }
    .demo-queue-item.active { border-color: #58a6ff; background: rgba(88,166,255,0.06); }
    .demo-queue-item.active.blocked-item { border-color: #f85149; background: rgba(248,81,73,0.06); }
    .demo-queue-item.active.safe-item { border-color: #3fb950; background: rgba(63,185,80,0.06); }
    .dqi-indicator {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
      background: #30363d;
      transition: background 0.3s, box-shadow 0.3s;
    }
    .demo-queue-item.active .dqi-indicator { background: #58a6ff; box-shadow: 0 0 6px rgba(88,166,255,0.5); }
    .demo-queue-item.active.blocked-item .dqi-indicator { background: #f85149; box-shadow: 0 0 6px rgba(248,81,73,0.5); }
    .demo-queue-item.active.safe-item .dqi-indicator { background: #3fb950; box-shadow: 0 0 6px rgba(63,185,80,0.5); }
    .dqi-text { flex: 1; color: #8b949e; line-height: 1.3; }
    .dqi-text strong { color: #c9d1d9; display: block; margin-bottom: 2px; }
    .dqi-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 100px;
      white-space: nowrap;
    }
    .dqi-badge.caught { background: rgba(248,81,73,0.12); color: #f85149; border: 1px solid rgba(248,81,73,0.2); }
    .dqi-badge.safe   { background: rgba(63,185,80,0.12);  color: #3fb950;  border: 1px solid rgba(63,185,80,0.2); }

    /* right panel — animated card */
    .demo-panel {
      background: #0d1117;
      border: 1px solid #21262d;
      border-radius: 12px;
      overflow: hidden;
      position: sticky;
      top: 24px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .demo-panel-header {
      background: #161b22;
      border-bottom: 1px solid #21262d;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dp-dots { display: flex; gap: 5px; }
    .dp-dot { width: 9px; height: 9px; border-radius: 50%; }
    .dp-dot.r { background: #ff5f57; } .dp-dot.y { background: #febc2e; } .dp-dot.g { background: #28c840; }
    .dp-label { font-size: 11px; color: #484f58; font-family: 'SF Mono', 'Fira Code', monospace; margin-left: 4px; }
    .demo-panel-body { padding: 16px; min-height: 320px; }
    .dp-scenario { display: none; }
    .dp-scenario.active { display: block; animation: fadeUp 0.35s ease both; }

    .dp-chat { margin-bottom: 12px; }
    .dp-bubble {
      background: #21262d;
      border-radius: 8px 8px 8px 2px;
      padding: 10px 14px;
      font-size: 13px;
      color: #e6edf3;
      line-height: 1.5;
    }
    .dp-file {
      display: flex;
      align-items: center;
      gap: 9px;
      margin-top: 9px;
      padding: 7px 10px;
      background: #0d1117;
      border-radius: 6px;
      border: 1px solid #21262d;
      font-size: 12px;
      color: #8b949e;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }
    .dp-file-icon { font-size: 15px; }

    .dp-steps { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
    .dp-step {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-family: 'SF Mono', 'Fira Code', monospace;
      color: #484f58;
      opacity: 0;
      transform: translateX(6px);
      transition: all 0.3s ease;
    }
    .dp-step.vis { opacity: 1; transform: translateX(0); color: #8b949e; }
    .dp-step.vis.ok   { color: #3fb950; }
    .dp-step.vis.bad  { color: #f85149; }
    .dp-step .sdot {
      width: 5px; height: 5px;
      border-radius: 50%;
      background: #30363d;
      flex-shrink: 0;
      transition: background 0.3s, box-shadow 0.3s;
    }
    .dp-step.vis .sdot { background: #58a6ff; box-shadow: 0 0 5px rgba(88,166,255,0.4); }
    .dp-step.vis.ok .sdot  { background: #3fb950; box-shadow: 0 0 5px rgba(63,185,80,0.4); }
    .dp-step.vis.bad .sdot { background: #f85149; box-shadow: 0 0 5px rgba(248,81,73,0.4); }

    .dp-verdict {
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      opacity: 0;
      transform: translateY(5px);
      transition: opacity 0.4s ease, transform 0.4s ease;
    }
    .dp-verdict.show { opacity: 1; transform: translateY(0); }
    .dp-verdict.blocked { background: rgba(248,81,73,0.1); border: 1px solid rgba(248,81,73,0.25); color: #f85149; animation: pulse-red 2.5s ease infinite; }
    .dp-verdict.allowed { background: rgba(63,185,80,0.1);  border: 1px solid rgba(63,185,80,0.25);  color: #3fb950; animation: pulse-green 2.5s ease infinite; }
    .dp-verdict-icon { font-size: 16px; flex-shrink: 0; }
    .dp-verdict-body { line-height: 1.4; }
    .dp-verdict-body strong { display: block; margin-bottom: 3px; }
    .dp-verdict-body span { font-weight: 400; color: inherit; opacity: 0.8; font-size: 12px; }

    /* progress dots */
    .demo-dots {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 24px;
    }
    .demo-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #21262d;
      border: 1px solid #30363d;
      cursor: pointer;
      transition: background 0.2s, box-shadow 0.2s;
    }
    .demo-dot.active { background: #58a6ff; border-color: #58a6ff; box-shadow: 0 0 6px rgba(88,166,255,0.4); }

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
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .axis-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
    .axis-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      border-radius: 12px 12px 0 0;
    }
    .axis-card.intent::before  { background: linear-gradient(90deg, #58a6ff, #1f6feb); }
    .axis-card.content::before { background: linear-gradient(90deg, #3fb950, #2ea043); }
    .axis-card.context::before { background: linear-gradient(90deg, #d2a8ff, #a371f7); }
    .axis-card .icon { font-size: 28px; margin-bottom: 14px; animation: float 4s ease infinite; }
    .axis-card.content .icon { animation-delay: 0.5s; }
    .axis-card.context .icon { animation-delay: 1s; }
    .axis-card h3 { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
    .axis-card p { font-size: 14px; color: #8b949e; line-height: 1.5; }

    /* ── Animated Pipeline ── */
    .pipeline-wrap { position: relative; }
    .pipeline {
      display: flex;
      align-items: stretch;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #21262d;
    }
    @media (max-width: 720px) { .pipeline { flex-direction: column; } }
    .pipeline-step {
      flex: 1;
      background: #161b22;
      padding: 20px 18px;
      text-align: center;
      position: relative;
      transition: background 0.5s;
    }
    .pipeline-step + .pipeline-step { border-left: 1px solid #21262d; }
    @media (max-width: 720px) { .pipeline-step + .pipeline-step { border-left: none; border-top: 1px solid #21262d; } }
    .pipeline-step.lit { background: rgba(88,166,255,0.07); }
    .pipeline-step.lit.outcome { background: rgba(248,81,73,0.07); }
    /* animated connector line inside each step when lit */
    .pipeline-step.lit::after {
      content: '';
      position: absolute;
      right: 0; top: 50%; bottom: auto;
      width: 2px;
      height: 0;
      background: #58a6ff;
      transform: translateY(-50%);
      animation: extend-line 0.4s ease forwards;
    }
    .pipeline-step.lit.outcome::after { background: #f85149; }
    @keyframes extend-line { from { height: 0; } to { height: 40%; } }
    @media (max-width: 720px) { .pipeline-step.lit::after { display: none; } }
    .step-num { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #484f58; margin-bottom: 6px; transition: color 0.3s; }
    .pipeline-step.lit .step-num { color: #58a6ff; }
    .pipeline-step.lit.outcome .step-num { color: #f85149; }
    .step-icon { font-size: 22px; margin-bottom: 6px; }
    .step-name { font-size: 13px; font-weight: 600; color: #c9d1d9; margin-bottom: 4px; }
    .step-desc { font-size: 12px; color: #484f58; line-height: 1.4; }
    .pipeline-step.outcome { background: rgba(31,111,235,0.06); }

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
      transition: border-color 0.2s;
    }
    .privacy-card:hover { border-color: #30363d; }
    .privacy-icon { font-size: 24px; flex-shrink: 0; margin-top: 2px; }
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
    .comparison .no  { color: #30363d; font-size: 16px; }
    .comparison .highlight { color: #58a6ff; font-weight: 600; }

    /* ── Pricing ── */
    .pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 640px) { .pricing-grid { grid-template-columns: 1fr; } }
    .pricing-card {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 32px 28px;
      position: relative;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .pricing-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
    .pricing-card.featured { border-color: #1f6feb; background: linear-gradient(180deg, rgba(31,111,235,0.06) 0%, #161b22 60%); }
    .pricing-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #1f6feb; color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; padding: 3px 12px; border-radius: 100px; white-space: nowrap; }
    .pricing-name { font-size: 14px; font-weight: 600; color: #8b949e; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .pricing-price { font-size: 40px; font-weight: 800; margin-bottom: 4px; }
    .pricing-note { font-size: 13px; color: #484f58; margin-bottom: 24px; }
    .pricing-card ul { list-style: none; padding: 0; margin-bottom: 28px; }
    .pricing-card ul li { font-size: 14px; color: #c9d1d9; padding: 6px 0 6px 22px; position: relative; }
    .pricing-card ul li::before { content: '✓'; position: absolute; left: 0; color: #3fb950; font-size: 13px; }
    .pricing-card .btn { width: 100%; text-align: center; }
    .pricing-footnote { font-size: 12px; color: #484f58; text-align: center; margin-top: 16px; }

    /* ── Contact ── */
    .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
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
      background: #0d1117; border: 1px solid #21262d; border-radius: 7px;
      color: #e6edf3; font-size: 14px; font-family: inherit; transition: border-color 0.15s;
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
    .footer { text-align: center; padding: 28px 24px; font-size: 13px; color: #484f58; border-top: 1px solid #21262d; }
    .footer a { color: #484f58; text-decoration: none; }
    .footer a:hover { color: #8b949e; }
    .footer-links { margin-top: 8px; display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }

    /* ══════════════════════════════════════════
       RESPONSIVE — MOBILE
    ══════════════════════════════════════════ */

    /* ── Small tablets & large phones (≤768px) ── */
    @media (max-width: 768px) {
      /* Hero */
      .hero { padding: 56px 20px 44px; }
      .hero-badge { font-size: 12px; padding: 4px 12px; }
      .hero-sub { font-size: 16px; }
      .hero-actions { margin-bottom: 36px; }
      .hero-actions .btn { padding: 11px 22px; font-size: 14px; }

      /* Threat feed */
      .threat-feed-wrap { max-width: 100%; }
      .tf-title { display: none; }
      .tf-event { padding: 14px 14px 4px; }
      .tf-analysis { font-size: 11px; }
      .tf-step { gap: 6px; }
      .tf-message { font-size: 13px; padding: 10px 12px; }
      .tf-file-name { font-size: 12px; }
      .tf-verdict { font-size: 13px; padding: 10px 12px; }
      .tf-verdict-text { font-size: 12px; }

      /* Proof bar */
      .proof-bar-inner { gap: 20px; }
      .proof-stat .num { font-size: 22px; }

      /* Sections */
      .section { padding: 52px 20px; }
      .section-title { font-size: 26px; }
      .section-sub { font-size: 15px; margin-bottom: 28px; }

      /* Demo section */
      .demo-inner { padding: 52px 20px; }
      .demo-layout { grid-template-columns: 1fr; gap: 20px; }
      /* On mobile the panel comes FIRST, queue below */
      .demo-queue { order: 2; }
      .demo-panel { order: 1; position: static; }
      .demo-panel-body { min-height: 280px; }
      /* Shrink queue items slightly */
      .demo-queue-item { padding: 10px 12px; font-size: 12px; }
      .dqi-badge { font-size: 10px; padding: 2px 7px; }

      /* Axes */
      .axes-grid { gap: 12px; }
      .axis-card { padding: 22px 18px; }
      .axis-card .icon { font-size: 24px; margin-bottom: 10px; }
      .axis-card h3 { font-size: 15px; }

      /* Pipeline */
      .pipeline-step { padding: 16px 14px; }
      .step-icon { font-size: 18px; }
      .step-name { font-size: 12px; }
      .step-desc { font-size: 11px; }

      /* Privacy cards */
      .privacy-grid { gap: 12px; }
      .privacy-card { padding: 18px; }

      /* Comparison */
      .comparison th, .comparison td { padding: 10px 12px; font-size: 13px; }

      /* Pricing */
      .pricing-card { padding: 28px 22px; }
      .pricing-price { font-size: 34px; }

      /* Contact */
      .contact-info h3 { font-size: 18px; }
      .form-group input, .form-group textarea { font-size: 16px; } /* prevent iOS zoom */

      /* CTA */
      .cta { padding: 60px 20px; }
      .cta h2 { font-size: 28px; }
      .cta p { font-size: 15px; }
      .cta-actions .btn { padding: 11px 22px; }
    }

    /* ── Phones (≤480px) ── */
    @media (max-width: 480px) {
      .hero { padding: 44px 16px 36px; }
      .hero-badge { font-size: 11px; text-align: left; }
      .hero-sub { font-size: 15px; }
      .hero-actions { flex-direction: column; align-items: stretch; gap: 10px; margin-bottom: 28px; }
      .hero-actions .btn { text-align: center; padding: 13px 20px; }
      .hero-actions .note { text-align: center; }

      /* Threat feed on small screens */
      .threat-feed-body { min-height: 240px; }
      .tf-meta .ts { display: none; } /* hide timestamp to save space */
      .tf-analysis { gap: 3px; }
      .tf-step { flex-wrap: wrap; }
      .tf-step .step-val { font-size: 10px; }

      /* Proof bar stacks */
      .proof-bar-inner { flex-direction: column; gap: 14px; align-items: flex-start; padding-left: 32px; }

      /* Sections */
      .section { padding: 44px 16px; }
      .section-title { font-size: 22px; }
      .section-sub { font-size: 14px; }

      /* Demo */
      .demo-inner { padding: 44px 16px; }
      .dp-steps { gap: 4px; }
      .dp-step { font-size: 11px; }
      .dp-bubble { font-size: 12px; padding: 9px 11px; }
      .dp-file { font-size: 11px; }
      .dp-verdict { font-size: 12px; padding: 9px 12px; }
      .dp-verdict-body span { font-size: 11px; }

      /* Pricing */
      .pricing-grid { gap: 16px; }
      .pricing-card { padding: 24px 18px; }
      .pricing-price { font-size: 30px; }

      /* Contact form full width */
      .form-row { grid-template-columns: 1fr; }

      /* CTA */
      .cta { padding: 48px 16px; }
      .cta h2 { font-size: 24px; }
      .cta-actions { flex-direction: column; align-items: stretch; gap: 10px; }
      .cta-actions .btn { text-align: center; }
    }
  </style>
</head>
<body>

  ${buildNav('features', req.session)}

  ${rateLimited ? '<div style="background:#da3633;color:#fff;padding:12px 24px;text-align:center;font-size:14px;">Too many submissions. Please try again later.</div>' : ''}

  <!-- ══ HERO ══ -->
  <section class="hero">
    <div class="hero-badge">68% of breaches involve a human element — Verizon DBIR 2024</div>
    <h1>Your DLP misses the<br><em>most common data leak</em></h1>
    <p class="hero-sub">Wrong file attachments cause more data incidents than phishing and malware combined. Intentify AI catches them in Slack before they leave.</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="/slack/oauth/install">Add to Slack &mdash; free</a>
      <a class="btn btn-secondary" href="#live-demo">See live demo ↓</a>
      <span class="note">2-minute setup &middot; Zero content retention &middot; No credit card</span>
    </div>

    <!-- Live threat feed terminal -->
    <div class="threat-feed-wrap">
      <div class="threat-feed-shell">
        <div class="threat-feed-header">
          <div class="tf-dots">
            <div class="tf-dot r"></div>
            <div class="tf-dot y"></div>
            <div class="tf-dot g"></div>
          </div>
          <span class="tf-title">intentify-ai &mdash; threat-monitor</span>
          <span class="tf-live">Live</span>
        </div>
        <div class="threat-feed-body" id="tfBody">
          <!-- events injected by JS -->
        </div>
        <div class="tf-progress"><div class="tf-progress-bar" id="tfBar"></div></div>
      </div>
    </div>
  </section>

  <!-- ── Proof bar ── -->
  <div class="proof-bar">
    <div class="proof-bar-inner">
      <div class="proof-stat"><div class="num">$4.88M</div><div class="lbl">avg. cost of a breach</div></div>
      <div class="proof-divider"></div>
      <div class="proof-stat"><div class="num">68%</div><div class="lbl">breaches: human element</div></div>
      <div class="proof-divider"></div>
      <div class="proof-stat"><div class="num">#1</div><div class="lbl">cause: wrong file sent</div></div>
      <div class="proof-divider"></div>
      <div class="proof-stat"><div class="num">2 min</div><div class="lbl">to deploy</div></div>
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
          <li>Links to sensitive files (Google Drive, Dropbox, OneDrive…)</li>
          <li>Pastebin / Gist links containing secrets or credentials</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- ══ LIVE DEMO SECTION ══ -->
  <div class="demo-section" id="live-demo">
    <div class="demo-inner">
      <div class="section-label">Live demo</div>
      <h2 class="section-title" style="margin-bottom:6px;">Watch Intentify AI in action</h2>
      <p class="section-sub">Real scenarios, running live. Click any case or let them cycle automatically.</p>

      <div class="demo-layout">
        <!-- left: queue -->
        <div class="demo-queue" id="demoQueue">
          <div class="demo-queue-item blocked-item" data-idx="0">
            <div class="dqi-indicator"></div>
            <div class="dqi-text"><strong>Wrong file — sales call</strong>"Here are the demo slides…" → Q1 financials</div>
            <div class="dqi-badge caught">Blocked</div>
          </div>
          <div class="demo-queue-item blocked-item" data-idx="1">
            <div class="dqi-indicator"></div>
            <div class="dqi-text"><strong>Fake anonymization</strong>"Anonymized customer report" → raw PII inside</div>
            <div class="dqi-badge caught">Blocked</div>
          </div>
          <div class="demo-queue-item blocked-item" data-idx="2">
            <div class="dqi-indicator"></div>
            <div class="dqi-text"><strong>Context violation</strong>Revenue forecast → #general (280 members)</div>
            <div class="dqi-badge caught">Blocked</div>
          </div>
          <div class="demo-queue-item blocked-item" data-idx="3">
            <div class="dqi-indicator"></div>
            <div class="dqi-text"><strong>Slack Connect leak</strong>Internal roadmap → external partner channel</div>
            <div class="dqi-badge caught">Blocked</div>
          </div>
          <div class="demo-queue-item blocked-item" data-idx="4">
            <div class="dqi-indicator"></div>
            <div class="dqi-text"><strong>API key in screenshot</strong>Debug screenshot → exposed AWS credentials</div>
            <div class="dqi-badge caught">Blocked</div>
          </div>
          <div class="demo-queue-item safe-item" data-idx="5">
            <div class="dqi-indicator"></div>
            <div class="dqi-text"><strong>Invoice — verified safe</strong>Invoice attached → #finance (private)</div>
            <div class="dqi-badge safe">Safe ✓</div>
          </div>
          <div class="demo-queue-item safe-item" data-idx="6">
            <div class="dqi-indicator"></div>
            <div class="dqi-text"><strong>Design asset — verified safe</strong>Logo variants → #design (internal)</div>
            <div class="dqi-badge safe">Safe ✓</div>
          </div>
          <div class="demo-queue-item blocked-item" data-idx="7">
            <div class="dqi-indicator"></div>
            <div class="dqi-text"><strong>Google Drive link leak</strong>"Onboarding doc" → Google Sheet with salary data</div>
            <div class="dqi-badge caught">Blocked</div>
          </div>
          <div class="demo-queue-item blocked-item" data-idx="8">
            <div class="dqi-indicator"></div>
            <div class="dqi-text"><strong>Pastebin with secrets</strong>"Config snippet" → API keys exposed on Pastebin</div>
            <div class="dqi-badge caught">Blocked</div>
          </div>
        </div>

        <!-- right: animated panel -->
        <div class="demo-panel">
          <div class="demo-panel-header">
            <div class="dp-dots"><div class="dp-dot r"></div><div class="dp-dot y"></div><div class="dp-dot g"></div></div>
            <span class="dp-label">intentify-ai &mdash; analysis</span>
          </div>
          <div class="demo-panel-body" id="demoPanelBody">

            <!-- Scenario 0 -->
            <div class="dp-scenario" data-idx="0">
              <div class="dp-chat">
                <div class="dp-bubble">
                  Here are the demo slides for tomorrow's sales call.
                  <div class="dp-file"><span class="dp-file-icon">📄</span><span class="dp-file-name">Q1_Financial_Results_FINAL.pdf</span></div>
                </div>
              </div>
              <div class="dp-steps">
                <div class="dp-step" data-delay="400"><span class="sdot"></span><span>→ parsing intent: "demo slides for sales call"</span></div>
                <div class="dp-step" data-delay="900"><span class="sdot"></span><span>→ extracting text from PDF…</span></div>
                <div class="dp-step ok" data-delay="1400"><span class="sdot"></span><span>→ content: Q1 revenue, EBITDA, margin figures</span></div>
                <div class="dp-step" data-delay="1800"><span class="sdot"></span><span>→ channel: #sales-team (semi-private, 12 members)</span></div>
                <div class="dp-step bad" data-delay="2200"><span class="sdot"></span><span>→ MISMATCH: financial report ≠ "demo slides"</span></div>
              </div>
              <div class="dp-verdict blocked" data-delay="2700">
                <span class="dp-verdict-icon">🛑</span>
                <div class="dp-verdict-body"><strong>File removed</strong><span>Financial data doesn't match stated intent. DM sent to sender with re-send prompt.</span></div>
              </div>
            </div>

            <!-- Scenario 1 -->
            <div class="dp-scenario" data-idx="1">
              <div class="dp-chat">
                <div class="dp-bubble">
                  Sharing the anonymized customer report for the board.
                  <div class="dp-file"><span class="dp-file-icon">📊</span><span class="dp-file-name">customer_report_anon_v2.xlsx</span></div>
                </div>
              </div>
              <div class="dp-steps">
                <div class="dp-step" data-delay="400"><span class="sdot"></span><span>→ parsing intent: "anonymized customer report"</span></div>
                <div class="dp-step" data-delay="900"><span class="sdot"></span><span>→ reading XLSX (3 sheets, 1,847 rows)…</span></div>
                <div class="dp-step bad" data-delay="1500"><span class="sdot"></span><span>→ PII detected: 1,847 email addresses</span></div>
                <div class="dp-step bad" data-delay="1900"><span class="sdot"></span><span>→ PII detected: customer names, phone numbers</span></div>
                <div class="dp-step bad" data-delay="2300"><span class="sdot"></span><span>→ MISMATCH: not anonymized — raw PII present</span></div>
              </div>
              <div class="dp-verdict blocked" data-delay="2800">
                <span class="dp-verdict-icon">🛑</span>
                <div class="dp-verdict-body"><strong>File removed</strong><span>Spreadsheet contains raw customer PII. Not anonymized as claimed.</span></div>
              </div>
            </div>

            <!-- Scenario 2 -->
            <div class="dp-scenario" data-idx="2">
              <div class="dp-chat">
                <div class="dp-bubble">
                  Here's the updated revenue forecast for Q2.
                  <div class="dp-file"><span class="dp-file-icon">📈</span><span class="dp-file-name">revenue_forecast_q2_2025.xlsx</span></div>
                </div>
              </div>
              <div class="dp-steps">
                <div class="dp-step" data-delay="400"><span class="sdot"></span><span>→ parsing intent: "revenue forecast Q2"</span></div>
                <div class="dp-step" data-delay="800"><span class="sdot"></span><span>→ content verified: financial projections ✓</span></div>
                <div class="dp-step bad" data-delay="1300"><span class="sdot"></span><span>→ channel: #general (PUBLIC, 280 members)</span></div>
                <div class="dp-step bad" data-delay="1800"><span class="sdot"></span><span>→ sensitivity: CONFIDENTIAL financial data</span></div>
                <div class="dp-step bad" data-delay="2200"><span class="sdot"></span><span>→ CONTEXT VIOLATION: public audience</span></div>
              </div>
              <div class="dp-verdict blocked" data-delay="2700">
                <span class="dp-verdict-icon">🛑</span>
                <div class="dp-verdict-body"><strong>File removed</strong><span>Confidential financial data shared in a public channel with 280 members.</span></div>
              </div>
            </div>

            <!-- Scenario 3 -->
            <div class="dp-scenario" data-idx="3">
              <div class="dp-chat">
                <div class="dp-bubble">
                  Hey team, here's the project status update for this sprint.
                  <div class="dp-file"><span class="dp-file-icon">📝</span><span class="dp-file-name">Product_Roadmap_H2_2025.pptx</span></div>
                </div>
              </div>
              <div class="dp-steps">
                <div class="dp-step" data-delay="400"><span class="sdot"></span><span>→ parsing intent: "project status update"</span></div>
                <div class="dp-step" data-delay="900"><span class="sdot"></span><span>→ content: internal roadmap, unreleased features</span></div>
                <div class="dp-step bad" data-delay="1400"><span class="sdot"></span><span>→ channel: #acme-project (Slack Connect)</span></div>
                <div class="dp-step bad" data-delay="1900"><span class="sdot"></span><span>→ external members: 3 (Acme Corp domain)</span></div>
                <div class="dp-step bad" data-delay="2300"><span class="sdot"></span><span>→ EXTERNAL LEAK: confidential to external</span></div>
              </div>
              <div class="dp-verdict blocked" data-delay="2800">
                <span class="dp-verdict-icon">🛑</span>
                <div class="dp-verdict-body"><strong>File removed</strong><span>Internal product roadmap shared in Slack Connect channel with 3 external partners.</span></div>
              </div>
            </div>

            <!-- Scenario 4 -->
            <div class="dp-scenario" data-idx="4">
              <div class="dp-chat">
                <div class="dp-bubble">
                  Screenshot of the bug I'm seeing in prod — can someone help?
                  <div class="dp-file"><span class="dp-file-icon">🖼️</span><span class="dp-file-name">debug_screenshot_prod.png</span></div>
                </div>
              </div>
              <div class="dp-steps">
                <div class="dp-step" data-delay="400"><span class="sdot"></span><span>→ parsing intent: "debug screenshot"</span></div>
                <div class="dp-step" data-delay="800"><span class="sdot"></span><span>→ running AI vision analysis on image…</span></div>
                <div class="dp-step bad" data-delay="1500"><span class="sdot"></span><span>→ detected: AWS_ACCESS_KEY_ID visible in terminal</span></div>
                <div class="dp-step bad" data-delay="2000"><span class="sdot"></span><span>→ pre-scan: high-entropy token pattern matched</span></div>
                <div class="dp-step bad" data-delay="2400"><span class="sdot"></span><span>→ CRITICAL: credentials exposed in screenshot</span></div>
              </div>
              <div class="dp-verdict blocked" data-delay="2900">
                <span class="dp-verdict-icon">🛑</span>
                <div class="dp-verdict-body"><strong>File removed</strong><span>Screenshot contains AWS credentials. Rotate your keys immediately.</span></div>
              </div>
            </div>

            <!-- Scenario 5 -->
            <div class="dp-scenario" data-idx="5">
              <div class="dp-chat">
                <div class="dp-bubble">
                  Invoice for March services attached.
                  <div class="dp-file"><span class="dp-file-icon">🧾</span><span class="dp-file-name">invoice_march_2025_acme.pdf</span></div>
                </div>
              </div>
              <div class="dp-steps">
                <div class="dp-step" data-delay="400"><span class="sdot"></span><span>→ parsing intent: "invoice for March services"</span></div>
                <div class="dp-step" data-delay="900"><span class="sdot"></span><span>→ extracting text from PDF…</span></div>
                <div class="dp-step ok" data-delay="1400"><span class="sdot"></span><span>→ content: invoice, amounts, line items ✓</span></div>
                <div class="dp-step ok" data-delay="1800"><span class="sdot"></span><span>→ channel: #finance (PRIVATE, 8 members) ✓</span></div>
                <div class="dp-step ok" data-delay="2200"><span class="sdot"></span><span>→ intent matches content, context appropriate ✓</span></div>
              </div>
              <div class="dp-verdict allowed" data-delay="2700">
                <span class="dp-verdict-icon">✅</span>
                <div class="dp-verdict-body"><strong>Verified safe</strong><span>Invoice content matches description, shared in private finance channel.</span></div>
              </div>
            </div>

            <!-- Scenario 6 -->
            <div class="dp-scenario" data-idx="6">
              <div class="dp-chat">
                <div class="dp-bubble">
                  New logo variants from the designer — v3 for review.
                  <div class="dp-file"><span class="dp-file-icon">🖼️</span><span class="dp-file-name">logo_v3_variants_final.png</span></div>
                </div>
              </div>
              <div class="dp-steps">
                <div class="dp-step" data-delay="400"><span class="sdot"></span><span>→ parsing intent: "logo variants for review"</span></div>
                <div class="dp-step" data-delay="800"><span class="sdot"></span><span>→ running AI vision analysis on image…</span></div>
                <div class="dp-step ok" data-delay="1400"><span class="sdot"></span><span>→ content: logo design variants, brand assets ✓</span></div>
                <div class="dp-step ok" data-delay="1900"><span class="sdot"></span><span>→ channel: #design (PRIVATE, 6 members) ✓</span></div>
                <div class="dp-step ok" data-delay="2300"><span class="sdot"></span><span>→ no sensitive content detected ✓</span></div>
              </div>
              <div class="dp-verdict allowed" data-delay="2800">
                <span class="dp-verdict-icon">✅</span>
                <div class="dp-verdict-body"><strong>Verified safe</strong><span>Image shows logo design variants, shared in private design channel. No sensitive content.</span></div>
              </div>
            </div>

            <!-- Scenario 7 -->
            <div class="dp-scenario" data-idx="7">
              <div class="dp-chat">
                <div class="dp-bubble">
                  Here's the onboarding doc for the new hire — please review.
                  <div class="dp-file"><span class="dp-file-icon">🔗</span><span class="dp-file-name">docs.google.com/spreadsheets/d/1BxiM…</span></div>
                </div>
              </div>
              <div class="dp-steps">
                <div class="dp-step" data-delay="400"><span class="sdot"></span><span>→ parsing intent: "onboarding doc for new hire"</span></div>
                <div class="dp-step" data-delay="800"><span class="sdot"></span><span>→ link detected: Google Sheets (spreadsheet)</span></div>
                <div class="dp-step bad" data-delay="1400"><span class="sdot"></span><span>→ URL path: /spreadsheets — likely salary/HR data</span></div>
                <div class="dp-step" data-delay="1900"><span class="sdot"></span><span>→ channel: #general (PUBLIC, 240 members)</span></div>
                <div class="dp-step bad" data-delay="2300"><span class="sdot"></span><span>→ MISMATCH: spreadsheet link in public channel</span></div>
              </div>
              <div class="dp-verdict blocked" data-delay="2800">
                <span class="dp-verdict-icon">🛑</span>
                <div class="dp-verdict-body"><strong>Link flagged</strong><span>Google Sheets link shared in public channel — may expose sensitive HR or salary data to 240 members.</span></div>
              </div>
            </div>

            <!-- Scenario 8 -->
            <div class="dp-scenario" data-idx="8">
              <div class="dp-chat">
                <div class="dp-bubble">
                  Sharing the config snippet I was talking about.
                  <div class="dp-file"><span class="dp-file-icon">🔗</span><span class="dp-file-name">pastebin.com/xK9mR2vT</span></div>
                </div>
              </div>
              <div class="dp-steps">
                <div class="dp-step" data-delay="400"><span class="sdot"></span><span>→ parsing intent: "config snippet"</span></div>
                <div class="dp-step bad" data-delay="800"><span class="sdot"></span><span>→ link type: Pastebin — high-risk (often secrets)</span></div>
                <div class="dp-step bad" data-delay="1300"><span class="sdot"></span><span>→ URL pattern: pastebin.com — public paste</span></div>
                <div class="dp-step bad" data-delay="1800"><span class="sdot"></span><span>→ channel: #engineering (24 members)</span></div>
                <div class="dp-step bad" data-delay="2200"><span class="sdot"></span><span>→ RISK: public paste may contain API keys/passwords</span></div>
              </div>
              <div class="dp-verdict blocked" data-delay="2700">
                <span class="dp-verdict-icon">🛑</span>
                <div class="dp-verdict-body"><strong>Link flagged</strong><span>Pastebin links are public and frequently contain exposed credentials. Verify the paste doesn't include secrets.</span></div>
              </div>
            </div>

          </div><!-- /demo-panel-body -->
        </div><!-- /demo-panel -->
      </div><!-- /demo-layout -->

      <div class="demo-dots" id="demoDots">
        <div class="demo-dot active" data-idx="0"></div>
        <div class="demo-dot" data-idx="1"></div>
        <div class="demo-dot" data-idx="2"></div>
        <div class="demo-dot" data-idx="3"></div>
        <div class="demo-dot" data-idx="4"></div>
        <div class="demo-dot" data-idx="5"></div>
        <div class="demo-dot" data-idx="6"></div>
        <div class="demo-dot" data-idx="7"></div>
        <div class="demo-dot" data-idx="8"></div>
      </div>
    </div>
  </div>

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
    <!-- animated pipeline -->
    <div class="pipeline-wrap">
      <div class="pipeline" id="pipeline">
        <div class="pipeline-step" data-step="0">
          <div class="step-num">Step 1</div>
          <div class="step-icon">📤</div>
          <div class="step-name">Message sent</div>
          <div class="step-desc">User shares file in Slack</div>
        </div>
        <div class="pipeline-step" data-step="1">
          <div class="step-num">Step 2</div>
          <div class="step-icon">⚡</div>
          <div class="step-name">Pre-scan</div>
          <div class="step-desc">Instant regex for CC, SSN, API keys</div>
        </div>
        <div class="pipeline-step" data-step="2">
          <div class="step-num">Step 3</div>
          <div class="step-icon">🧠</div>
          <div class="step-name">AI analysis</div>
          <div class="step-desc">Intent × Content × Context</div>
        </div>
        <div class="pipeline-step" data-step="3">
          <div class="step-num">Step 4</div>
          <div class="step-icon">⚖️</div>
          <div class="step-name">Verdict</div>
          <div class="step-desc">Match, mismatch, or uncertain</div>
        </div>
        <div class="pipeline-step outcome" data-step="4">
          <div class="step-num">Mismatch</div>
          <div class="step-icon">🛑</div>
          <div class="step-name">File removed</div>
          <div class="step-desc">DM sent · re-send prompt</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Privacy ── -->
  <section class="section" style="border-top:1px solid #21262d;">
    <div class="section-label">Privacy &amp; Security</div>
    <h2 class="section-title">Built privacy-first from day one</h2>
    <p class="section-sub">Enterprise DLP without the enterprise data risk. Your files never leave the analysis pipeline.</p>
    <div class="privacy-grid">
      <div class="privacy-card">
        <div class="privacy-icon">🔒</div>
        <div><h3>Zero content retention</h3><p>File contents and message text are processed in-memory and immediately discarded. Only privacy-safe metadata (labels, scores) is stored. Never used for model training.</p></div>
      </div>
      <div class="privacy-card">
        <div class="privacy-icon">✅</div>
        <div><h3>Fail-open design</h3><p>Errors and uncertain results never block users. If the AI is unsure or a request fails, the file passes through. Zero workflow disruption.</p></div>
      </div>
      <div class="privacy-card">
        <div class="privacy-icon">🏢</div>
        <div><h3>Workspace isolation</h3><p>Each workspace's data is fully isolated. Analysis requests are stateless with no cross-workspace data exposure.</p></div>
      </div>
      <div class="privacy-card">
        <div class="privacy-icon">🔍</div>
        <div><h3>Full audit trail</h3><p>Every verdict is logged to your admin dashboard. Review evaluations, tune thresholds, and export compliance reports.</p></div>
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
        <thead><tr><th>Capability</th><th>Intentify AI</th><th>Traditional DLP</th></tr></thead>
        <tbody>
          <tr><td>Setup time</td><td class="highlight">2 minutes</td><td>Days to weeks</td></tr>
          <tr><td>Intent vs content verification</td><td class="yes">✓</td><td class="no">✗</td></tr>
          <tr><td>PII pattern matching (CC, SSN, API keys)</td><td class="yes">✓</td><td class="yes">✓</td></tr>
          <tr><td>AI vision for images &amp; screenshots</td><td class="yes">✓</td><td class="no">✗</td></tr>
          <tr><td>Channel audience awareness</td><td class="yes">✓</td><td class="no">✗</td></tr>
          <tr><td>Slack Connect / external guest detection</td><td class="yes">✓</td><td class="no">✗</td></tr>
          <tr><td>Shared link detection (Drive, Dropbox, OneDrive…)</td><td class="yes">✓</td><td class="no">✗</td></tr>
          <tr><td>Pastebin / Gist secret exposure detection</td><td class="yes">✓</td><td class="no">✗</td></tr>
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
          <li>All detection features</li><li>Unlimited workspaces</li>
          <li>Admin dashboard</li><li>Evaluation history</li>
          <li>90-day retention</li><li>Community support</li>
        </ul>
        <a class="btn btn-primary" href="/slack/oauth/install">Add to Slack</a>
      </div>
      <div class="pricing-card">
        <div class="pricing-name">Pro</div>
        <div class="pricing-price">Coming soon</div>
        <div class="pricing-note">Everything in Community, plus:</div>
        <ul>
          <li>Priority support &amp; SLA</li><li>Custom retention policies</li>
          <li>Audit log export (CSV/JSON)</li><li>Dedicated onboarding</li>
          <li>Custom alert thresholds</li><li>Compliance reports</li>
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
            <div class="form-group"><label for="name">Name *</label><input type="text" id="name" name="name" required maxlength="100" placeholder="Your name"></div>
            <div class="form-group"><label for="email">Work email *</label><input type="email" id="email" name="email" required maxlength="200" placeholder="you@company.com"></div>
          </div>
          <div class="form-group"><label for="company">Company</label><input type="text" id="company" name="company" maxlength="200" placeholder="Your company"></div>
          <div class="form-group"><label for="message">Message</label><textarea id="message" name="message" maxlength="1000" rows="4" placeholder="Tell us about your use case..."></textarea></div>
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

  <!-- ══════════════════════════════════════════
       JAVASCRIPT: animations
  ══════════════════════════════════════════ -->
  <script>
  /* ── 1. HERO THREAT FEED ── */
  (function() {
    const EVENTS = [
      {
        type: 'blocked',
        channel: '#sales-team', user: 'sarah.k',
        msg: 'Here are the demo slides for the call.',
        file: '📄 Q1_Financial_Results_FINAL.pdf',
        steps: [
          { label: 'intent parsed', val: '"demo slides"', cls: '' },
          { label: 'extracting PDF text', val: '3.2 MB', cls: '' },
          { label: 'content: financial report', val: 'Q1 revenue / EBITDA', cls: 'warn' },
          { label: 'MISMATCH', val: 'financial ≠ slides', cls: 'warn' },
        ],
        verdict: '🛑 File removed — financial report ≠ "demo slides". DM sent.',
        verdictCls: 'blocked',
      },
      {
        type: 'blocked',
        channel: '#general', user: 'mike.t',
        msg: 'Revenue forecast for Q2 attached.',
        file: '📈 revenue_forecast_q2_2025.xlsx',
        steps: [
          { label: 'intent parsed', val: '"revenue forecast"', cls: '' },
          { label: 'content: financial projections', val: 'verified ✓', cls: '' },
          { label: 'channel: #general', val: 'PUBLIC · 280 members', cls: 'warn' },
          { label: 'CONTEXT VIOLATION', val: 'confidential → public', cls: 'warn' },
        ],
        verdict: '🛑 File removed — confidential data in public channel (280 members).',
        verdictCls: 'blocked',
      },
      {
        type: 'blocked',
        channel: '#acme-project', user: 'dan.r',
        msg: 'Sprint status update for the team.',
        file: '📝 Product_Roadmap_H2_2025.pptx',
        steps: [
          { label: 'intent parsed', val: '"status update"', cls: '' },
          { label: 'content: internal roadmap', val: 'unreleased features', cls: '' },
          { label: 'channel: Slack Connect', val: '3 external members', cls: 'warn' },
          { label: 'EXTERNAL LEAK', val: 'roadmap → partners', cls: 'warn' },
        ],
        verdict: '🛑 File removed — internal roadmap shared with 3 external partners.',
        verdictCls: 'blocked',
      },
      {
        type: 'blocked',
        channel: '#engineering', user: 'priya.s',
        msg: 'Screenshot of the prod bug — help?',
        file: '🖼️ debug_screenshot_prod.png',
        steps: [
          { label: 'running AI vision', val: 'image analysis…', cls: '' },
          { label: 'pre-scan: high-entropy token', val: 'matched', cls: 'warn' },
          { label: 'detected: AWS_ACCESS_KEY', val: 'visible in terminal', cls: 'warn' },
          { label: 'CRITICAL', val: 'credentials exposed', cls: 'warn' },
        ],
        verdict: '🛑 File removed — AWS credentials visible. Rotate your keys now.',
        verdictCls: 'blocked',
      },
      {
        type: 'safe',
        channel: '#finance', user: 'emma.w',
        msg: 'Invoice for March services.',
        file: '🧾 invoice_march_2025.pdf',
        steps: [
          { label: 'intent parsed', val: '"invoice"', cls: '' },
          { label: 'content: invoice, line items', val: 'verified ✓', cls: '' },
          { label: 'channel: #finance', val: 'PRIVATE · 8 members ✓', cls: 'ok' },
          { label: 'MATCH', val: 'intent = content = context', cls: 'ok' },
        ],
        verdict: '✅ Verified safe — invoice matches description, private channel.',
        verdictCls: 'allowed',
      },
    ];

    const STEP_DELAYS = [400, 900, 1400, 1900];
    const VERDICT_DELAY = 2600;
    const HOLD_MS = 1800;
    const CYCLE_MS = VERDICT_DELAY + HOLD_MS + 600;

    const body = document.getElementById('tfBody');
    const bar  = document.getElementById('tfBar');
    let current = 0;
    let barTimer = null;

    function buildEvent(ev) {
      const wrap = document.createElement('div');
      wrap.className = 'tf-event';
      wrap.innerHTML = \`
        <div class="tf-meta">
          <span class="channel">\${ev.channel}</span>
          <span style="color:#30363d;">·</span>
          <span class="user">\${ev.user}</span>
          <span class="ts">\${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
        </div>
        <div class="tf-message">
          \${ev.msg}
          <div class="tf-file"><span>\${ev.file}</span></div>
        </div>
        <div class="tf-analysis">
          \${ev.steps.map((s,i) => \`
            <div class="tf-step \${s.cls}" data-delay="\${STEP_DELAYS[i]}">
              <span class="step-dot"></span>
              <span class="step-label">→ \${s.label}</span>
              <span class="step-val">\${s.val}</span>
            </div>
          \`).join('')}
        </div>
        <div class="tf-verdict \${ev.verdictCls}" data-delay="\${VERDICT_DELAY}">
          <span class="tf-verdict-icon">\${ev.verdictCls === 'blocked' ? '🛑' : '✅'}</span>
          <span class="tf-verdict-text">\${ev.verdict}</span>
        </div>
      \`;
      return wrap;
    }

    function animate(wrap) {
      const steps   = wrap.querySelectorAll('.tf-step');
      const verdict = wrap.querySelector('.tf-verdict');
      steps.forEach(s => {
        const d = parseInt(s.dataset.delay, 10);
        setTimeout(() => s.classList.add('done'), d);
      });
      const vd = parseInt(verdict.dataset.delay, 10);
      setTimeout(() => verdict.classList.add('show'), vd);
    }

    function runBar(ms) {
      if (barTimer) clearInterval(barTimer);
      bar.style.transition = 'none';
      bar.style.width = '0%';
      requestAnimationFrame(() => {
        bar.style.transition = \`width \${ms}ms linear\`;
        bar.style.width = '100%';
      });
    }

    function showEvent(idx) {
      const old = body.querySelector('.tf-event.active');
      if (old) {
        old.classList.add('leaving');
        setTimeout(() => old.remove(), 300);
      }
      const ev   = EVENTS[idx % EVENTS.length];
      const wrap = buildEvent(ev);
      wrap.classList.add('active', 'entering');
      body.appendChild(wrap);
      setTimeout(() => wrap.classList.remove('entering'), 400);
      animate(wrap);
      runBar(CYCLE_MS);
    }

    // kick off
    showEvent(current);
    setInterval(() => {
      current = (current + 1) % EVENTS.length;
      showEvent(current);
    }, CYCLE_MS);
  })();

  /* ── 2. DEMO SECTION ── */
  (function() {
    const SCENARIOS = 9;
    const STEP_DELAYS_DEMO = [400, 900, 1500, 2000, 2400]; // per scenario (max 5 steps)
    const VERDICT_DELAYS   = [2700, 2800, 2700, 2800, 2900, 2700, 2800, 2800, 2700];
    const HOLD             = 2000;
    const TOTAL_CYCLE      = 8000;

    let current = 0;
    let autoTimer = null;
    let paused = false;

    const queue     = document.getElementById('demoQueue');
    const panelBody = document.getElementById('demoPanelBody');
    const dotsEl    = document.getElementById('demoDots');

    const queueItems = queue.querySelectorAll('.demo-queue-item');
    const panels     = panelBody.querySelectorAll('.dp-scenario');
    const dots       = dotsEl.querySelectorAll('.demo-dot');

    function showScenario(idx) {
      // update queue
      queueItems.forEach(i => i.classList.remove('active'));
      queueItems[idx].classList.add('active');

      // update dots
      dots.forEach(d => d.classList.remove('active'));
      dots[idx].classList.add('active');

      // update panel
      panels.forEach(p => p.classList.remove('active'));
      const panel = panels[idx];
      panel.classList.add('active');

      // reset and animate steps
      const steps   = panel.querySelectorAll('.dp-step');
      const verdict = panel.querySelector('.dp-verdict');

      steps.forEach(s => s.classList.remove('vis'));
      verdict.classList.remove('show');

      steps.forEach((s, i) => {
        const d = parseInt(s.dataset.delay || (400 + i * 500), 10);
        setTimeout(() => s.classList.add('vis'), d);
      });
      const vd = VERDICT_DELAYS[idx] || 2700;
      setTimeout(() => verdict.classList.add('show'), vd);
    }

    function next() {
      current = (current + 1) % SCENARIOS;
      showScenario(current);
    }

    function startAuto() {
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = setInterval(next, TOTAL_CYCLE);
    }

    // queue clicks
    queueItems.forEach(item => {
      item.addEventListener('click', () => {
        paused = true;
        clearInterval(autoTimer);
        const idx = parseInt(item.dataset.idx, 10);
        current = idx;
        showScenario(idx);
        // resume auto after 12s idle
        setTimeout(() => { paused = false; startAuto(); }, 12000);
      });
    });

    // dot clicks
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.dataset.idx, 10);
        current = idx;
        showScenario(idx);
        clearInterval(autoTimer);
        setTimeout(() => startAuto(), 12000);
      });
    });

    showScenario(0);
    startAuto();
  })();

  /* ── 3. PIPELINE ANIMATION ── */
  (function() {
    const steps = document.querySelectorAll('#pipeline .pipeline-step');
    if (!steps.length) return;
    let current = 0;

    function lightStep(idx) {
      steps.forEach(s => s.classList.remove('lit'));
      if (idx < steps.length) steps[idx].classList.add('lit');
    }

    function runCycle() {
      let i = 0;
      const tick = () => {
        lightStep(i);
        i++;
        if (i <= steps.length) {
          setTimeout(tick, i === steps.length ? 1200 : 520);
        } else {
          // pause then restart
          setTimeout(runCycle, 1200);
        }
      };
      tick();
    }

    // Only animate when visible (IntersectionObserver)
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        obs.disconnect();
        runCycle();
      }
    }, { threshold: 0.3 });
    obs.observe(document.getElementById('pipeline'));
  })();
  </script>

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

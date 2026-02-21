const express = require('express');
const logger = require('../lib/logger');
const { validateLogin, COOKIE_NAME, COOKIE_MAX_AGE } = require('../lib/auth');

const router = express.Router();

function loginPage(error = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IntentGuard — Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .login-card {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 12px;
      padding: 48px 40px;
      max-width: 400px;
      width: 100%;
    }
    .login-card img { height: 48px; width: 48px; margin-bottom: 16px; }
    .login-card h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .login-card h1 span {
      background: linear-gradient(135deg, #58a6ff, #3fb950);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .login-card p {
      font-size: 14px;
      color: #8b949e;
      margin-bottom: 24px;
    }
    .form-group { margin-bottom: 16px; }
    .form-group label {
      display: block;
      font-size: 13px;
      color: #8b949e;
      margin-bottom: 6px;
    }
    .form-group input {
      width: 100%;
      padding: 10px 12px;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      color: #e6edf3;
      font-size: 14px;
    }
    .form-group input:focus {
      outline: none;
      border-color: #58a6ff;
      box-shadow: 0 0 0 3px rgba(88,166,255,0.2);
    }
    .btn {
      width: 100%;
      padding: 10px;
      background: #238636;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn:hover { background: #2ea043; }
    .error {
      background: #da36331a;
      border: 1px solid #f8514933;
      color: #f85149;
      padding: 10px 12px;
      border-radius: 6px;
      font-size: 13px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="login-card">
    <img src="/public/logo.png" alt="IntentGuard">
    <h1><span>IntentGuard</span></h1>
    <p>Enter your admin secret to access the dashboard.</p>
    ${error ? `<div class="error">${error}</div>` : ''}
    <form method="POST" action="/admin/login">
      <div class="form-group">
        <label for="secret">Admin Secret</label>
        <input type="password" id="secret" name="secret" placeholder="Enter admin secret" required autofocus>
      </div>
      <button type="submit" class="btn">Sign in</button>
    </form>
  </div>
</body>
</html>`;
}

// GET /admin/login — show login form
router.get('/', (req, res) => {
  // If ADMIN_SECRET not set, redirect to admin (no auth needed)
  if (!process.env.ADMIN_SECRET) {
    return res.redirect('/admin/evaluations');
  }
  res.send(loginPage());
});

// POST /admin/login — validate secret and set cookie
router.post('/', express.urlencoded({ extended: false }), (req, res) => {
  const { secret } = req.body;
  const result = validateLogin(secret);

  if (!result.valid) {
    logger.warn({ ip: req.ip }, 'Failed admin login attempt');
    return res.status(401).send(loginPage('Invalid admin secret. Please try again.'));
  }

  res.cookie(COOKIE_NAME, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  logger.info({ ip: req.ip }, 'Admin login successful');
  res.redirect('/admin/evaluations');
});

// GET /admin/logout — clear cookie and redirect to login
router.get('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.redirect('/admin/login');
});

module.exports = router;

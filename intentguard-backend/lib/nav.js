/**
 * Shared navigation bar builder.
 * @param {string} activePage - 'home' | 'features' | 'admin' | 'integrations' | 'integrations-slack'
 * @param {object} [session] - Optional session object from auth middleware
 * @returns {string} HTML string for the nav bar
 */
function buildNav(activePage, session) {
  const link = (href, label, page) => {
    const isActive = activePage === page;
    const color = isActive ? '#58a6ff' : '#8b949e';
    const weight = isActive ? 'font-weight:600;' : '';
    return `<a href="${href}" style="color:${color};text-decoration:none;font-size:14px;${weight}">${label}</a>`;
  };

  // Integrations breadcrumb: "Integrations / Slack" when on a sub-page
  let integrationsHtml;
  if (activePage === 'integrations-slack') {
    integrationsHtml = `<span style="display:inline-flex;align-items:center;">
      <a href="/admin/integrations" style="color:#8b949e;text-decoration:none;font-size:14px;">Integrations</a>
      <span style="color:#484f58;margin:0 6px;">/</span>
      <a href="/admin/integrations/slack" style="color:#58a6ff;text-decoration:none;font-size:14px;font-weight:600;">Slack</a>
    </span>`;
  } else {
    integrationsHtml = link('/admin/integrations', 'Integrations', 'integrations');
  }

  const teamBadge = session?.teamName
    ? `<span style="color:#8b949e;font-size:12px;background:#21262d;padding:3px 10px;border-radius:4px;margin-left:auto;">${escapeHtml(session.teamName)}</span>`
    : '';

  const logoutMargin = teamBadge ? '' : 'margin-left:auto;';

  return `<nav style="background:#161b22;border-bottom:1px solid #21262d;padding:12px 24px;display:flex;align-items:center;gap:20px;">
  <a href="/" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:#e6edf3;font-weight:700;font-size:16px;">
    <img src="/public/logo.png" alt="Intentify AI" style="height:28px;width:28px;">Intentify AI
  </a>
  ${link('/features', 'Features', 'features')}
  ${link('/admin/evaluations', 'Evaluations', 'admin')}
  ${link('/admin/stats', 'Stats', 'stats')}
  ${integrationsHtml}
  ${teamBadge}
  <a href="/admin/login/logout" style="color:#8b949e;text-decoration:none;font-size:13px;${logoutMargin}">Logout</a>
</nav>`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildHead({ title, description, path, type = 'website', jsonLd = null }) {
  const base = 'https://intentify.tech';
  const url = `${base}${path}`;
  const image = `${base}/public/logo.png`;
  return `
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${url}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${image}">
    <meta property="og:type" content="${type}">
    <meta property="og:site_name" content="Intentify AI">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${image}">
    ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
  `;
}

module.exports = { buildNav, buildHead };

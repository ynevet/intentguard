/**
 * Shared navigation bar builder.
 * @param {string} activePage - 'home' | 'features' | 'admin' | 'integrations' | 'integrations-slack'
 * @returns {string} HTML string for the nav bar
 */
function buildNav(activePage) {
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

  return `<nav style="background:#161b22;border-bottom:1px solid #21262d;padding:12px 24px;display:flex;align-items:center;gap:20px;">
  <a href="/" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:#e6edf3;font-weight:700;font-size:16px;">
    <img src="/public/logo.png" alt="IntentGuard" style="height:28px;width:28px;">IntentGuard
  </a>
  ${link('/features', 'Features', 'features')}
  ${link('/admin/evaluations', 'Evaluations', 'admin')}
  ${link('/admin/stats', 'Stats', 'stats')}
  ${integrationsHtml}
  <a href="/admin/login/logout" style="color:#8b949e;text-decoration:none;font-size:13px;margin-left:auto;">Logout</a>
</nav>`;
}

module.exports = { buildNav };

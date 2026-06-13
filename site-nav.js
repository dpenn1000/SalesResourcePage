/* site-nav.js -- one consistent quick-access nav on every authenticated page.
 *
 * A floating top-right pill cluster: My Page / Admin / Resources. Self-contained
 * (injects its own CSS + DOM), idempotent, and role-gated. Loaded site-wide by
 * auth-gate.js AFTER sign-in (so window.IS_MANAGER / IS_ADMIN / AUTH_PROFILE are
 * already set and it never shows on the login screen).
 *
 * This replaces the old green bottom-left "back to Resources" button
 * (site-back.js, now retired): "Resources" lives here in the top-right instead.
 *
 *   - Resources  -> /            (everyone)
 *   - My Page    -> /me/         (everyone; the /me/ profile is the self-view)
 *   - Admin      -> /admin.html  (managers / admins only)
 *
 * The button for the page you're on renders as an inert "active" chip.
 */
(function () {
  if (window.__ct_nav_loaded) return;
  window.__ct_nav_loaded = true;

  function norm(p) { return (p || '/').replace(/\/index\.html$/i, '/'); }

  function build() {
    if (document.getElementById('ct-nav')) return;
    var path = norm(location.pathname);
    var isManager = !!(window.IS_MANAGER || window.IS_ADMIN);

    var style = document.createElement('style');
    style.textContent =
      '#ct-nav{position:fixed;top:10px;right:14px;z-index:2147483000;display:flex;gap:8px;' +
        "font-family:'Manrope',system-ui,-apple-system,'Segoe UI',sans-serif;}" +
      '#ct-nav a,#ct-nav span{display:inline-flex;align-items:center;padding:7px 13px;' +
        'border-radius:8px;font-size:12px;font-weight:700;letter-spacing:.01em;line-height:1;' +
        'white-space:nowrap;text-decoration:none;' +
        'background:rgba(26,35,50,.74);color:rgba(255,255,255,.92);' +
        'border:1px solid rgba(255,255,255,.16);' +
        '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);' +
        'box-shadow:0 4px 14px rgba(11,17,32,.22);' +
        'transition:background .12s,border-color .12s,transform .12s;}' +
      '#ct-nav a:hover{background:rgba(41,169,225,.92);border-color:rgba(41,169,225,.92);' +
        'color:#04222e;transform:translateY(-1px);}' +
      '#ct-nav .cn-active{background:rgba(41,169,225,.92);border-color:rgba(41,169,225,.92);' +
        'color:#04222e;cursor:default;}' +
      '@media print{#ct-nav{display:none;}}' +
      '@media (max-width:560px){#ct-nav{top:8px;right:8px;gap:6px;}' +
        '#ct-nav a,#ct-nav span{padding:7px 11px;}}';
    document.head.appendChild(style);

    var items = [
      { label: 'My Page',   href: '/me/',        match: function (p) { return p === '/me/'; } },
    ];
    if (isManager) items.push(
      { label: 'Admin',     href: '/admin.html', match: function (p) { return /admin\.html$/.test(p); } }
    );
    items.push(
      { label: 'Resources', href: '/',           match: function (p) { return p === '/'; } }
    );

    var nav = document.createElement('nav');
    nav.id = 'ct-nav';
    nav.setAttribute('aria-label', 'Quick navigation');
    items.forEach(function (it) {
      var el;
      if (it.match(path)) { el = document.createElement('span'); el.className = 'cn-active'; }
      else { el = document.createElement('a'); el.href = it.href; }
      el.setAttribute('aria-current', it.match(path) ? 'page' : 'false');
      el.textContent = it.label;
      nav.appendChild(el);
    });
    document.body.appendChild(nav);
  }

  function start() {
    if (document.body) build();
    else document.addEventListener('DOMContentLoaded', build);
  }

  // auth-gate loads us after AUTH_PROFILE is set; poll as a safety net anyway.
  if (window.AUTH_PROFILE) { start(); return; }
  var tries = 0;
  var t = setInterval(function () {
    if (window.AUTH_PROFILE || tries++ > 100) { clearInterval(t); start(); }
  }, 50);
})();

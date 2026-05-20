/* site-back.js -- one homogeneous "back to the CT Resource Page" button on every
 * page. Loaded site-wide; injects a fixed bottom-left pill that links to the
 * landing page. Bottom-left avoids the sticky top headers most pages use.
 * Self-skips on the landing page itself. Single source of truth for the control.
 */
(function () {
  // Skip on the landing page (root index).
  var path = location.pathname.replace(/\/index\.html$/i, '/');
  if (path === '/' || path === '') return;
  if (document.getElementById('site-back-btn')) return;

  function inject() {
    if (document.getElementById('site-back-btn')) return;

    var style = document.createElement('style');
    style.textContent =
      '#site-back-btn{position:fixed;left:16px;bottom:16px;z-index:2147483000;' +
      'display:inline-flex;align-items:center;gap:7px;padding:10px 15px;' +
      "font-family:'Manrope',system-ui,-apple-system,Segoe UI,sans-serif;" +
      'font-weight:700;font-size:13.5px;letter-spacing:.01em;color:#0b1120;' +
      'background:#78C832;border:1px solid #5eba28;border-radius:999px;' +
      'text-decoration:none;box-shadow:0 4px 14px rgba(11,17,32,.18);' +
      'transition:transform .12s,box-shadow .12s,background .12s;}' +
      '#site-back-btn:hover{background:#5eba28;transform:translateY(-1px);' +
      'box-shadow:0 6px 18px rgba(11,17,32,.24);}' +
      '#site-back-btn .sbb-arrow{font-size:16px;line-height:1;}' +
      '@media print{#site-back-btn{display:none;}}' +
      '@media (max-width:520px){#site-back-btn .sbb-label{display:none;}' +
      '#site-back-btn{padding:11px;}}';
    document.head.appendChild(style);

    var a = document.createElement('a');
    a.id = 'site-back-btn';
    a.href = '/';
    a.title = 'Back to the CT Resource Page';
    a.setAttribute('aria-label', 'Back to the CT Resource Page');
    a.innerHTML = '<span class="sbb-arrow" aria-hidden="true">←</span>' +
                  '<span class="sbb-label">CT Resource Page</span>';
    document.body.appendChild(a);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();

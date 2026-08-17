/**
 * ASK -- the sitewide answer button for ct-resource-page.com.
 *
 * Drop-in:  <script src="/ask-widget.js" defer></script>
 *
 * Renders a floating "Ask" button that opens a panel where anyone signed in
 * can ask a question in plain language and get an answer drawn from Trinity's
 * own material: the training pages, the objection field guides, and the
 * Operations Master Reference.
 *
 * ONE function, ONE code path, for everybody. The panel does not decide what
 * you may see. It sends the question to /api/ask on the launcher, which
 * resolves entitlement from your identity (lib/ask_scope) and searches only
 * what your tier and department allow. A rep, a DM, and an executive run the
 * same request; the server decides what it reaches.
 *
 * Two things this panel will never do:
 *   - Answer from the model's own knowledge. Every answer is drawn from
 *     retrieved passages and carries links back to them. The page is the
 *     receipt.
 *   - Print a price the model wrote. Pricing comes back as exact records from
 *     the source data and is rendered as its own card, above the prose.
 *
 * Styling is scoped to .tsp-ask and defines its own custom properties on that
 * element rather than on :root, so it cannot disturb a host page's tokens
 * (every page on this stack declares its own).
 */
(function () {
  'use strict';

  if (window.__tsp_ask_loaded__) return;
  window.__tsp_ask_loaded__ = true;

  // The launcher. Same origin as the tools subdomain; CORS + Bearer auth are
  // already configured there for exactly this cross-origin pattern.
  var API_BASE = 'https://tools.ct-resource-page.com';

  var PLACEHOLDERS = [
    'What do I say when they want to think about it?',
    'What is the floor on an Eversource PPA?',
    'The home is in a trust. What now?',
    'They say another company was cheaper.',
    'How do the Sales Clubs work?'
  ];

  // ── styles ────────────────────────────────────────────────────────────────
  var CSS = `
.tsp-ask {
  --ask-ink:#1A2332; --ask-card:#ffffff; --ask-bg:#f5f3ee;
  --ask-line:#d8d2c4; --ask-muted:#5B6576; --ask-green:#78C832;
  --ask-green-dk:#4A8A14; --ask-green-bg:#EDFAD6; --ask-blue:#29A9E1;
  --ask-amber-bg:#fff3d8; --ask-amber:#8a6100;
  --ask-radius:12px; --ask-shadow:0 8px 30px rgba(0,0,0,.18);
  font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;
}
/* Declare our own box model rather than inheriting the host page's reset.
   Most pages on this stack set a universal border-box rule, but the widget is
   injected into whatever is there, and under content-box the full-bleed mobile
   panel overflows the viewport by its border width. */
.tsp-ask, .tsp-ask *, .tsp-ask *::before, .tsp-ask *::after { box-sizing:border-box; }
.tsp-ask-fab {
  position:fixed; right:18px; bottom:18px; z-index:2147482000;
  display:flex; align-items:center; gap:8px;
  padding:13px 20px; border:0; border-radius:999px; cursor:pointer;
  background:var(--ask-ink); color:#fff; font-weight:700; font-size:15px;
  box-shadow:0 4px 18px rgba(0,0,0,.22);
  transition:transform .12s ease, box-shadow .12s ease;
}
.tsp-ask-fab:hover { transform:translateY(-2px); box-shadow:0 7px 24px rgba(0,0,0,.28); }
.tsp-ask-fab:focus-visible { outline:3px solid var(--ask-green); outline-offset:2px; }
.tsp-ask-fab .dot { width:9px; height:9px; border-radius:50%; background:var(--ask-green); }
.tsp-ask-scrim {
  position:fixed; inset:0; z-index:2147482100; background:rgba(12,18,28,.42);
  opacity:0; pointer-events:none; transition:opacity .16s ease;
}
.tsp-ask.open .tsp-ask-scrim { opacity:1; pointer-events:auto; }
.tsp-ask-panel {
  position:fixed; z-index:2147482200; right:16px; bottom:16px;
  width:min(460px, calc(100vw - 32px)); max-height:min(76vh, 720px);
  display:flex; flex-direction:column; overflow:hidden;
  background:var(--ask-card); color:var(--ask-ink);
  border:1px solid var(--ask-line); border-radius:var(--ask-radius);
  box-shadow:var(--ask-shadow);
  transform:translateY(12px) scale(.98); opacity:0; pointer-events:none;
  transition:opacity .16s ease, transform .16s ease;
}
.tsp-ask.open .tsp-ask-panel { opacity:1; transform:none; pointer-events:auto; }
/* On a phone -- the in-home case -- take the full sheet. */
@media (max-width:560px) {
  .tsp-ask-panel { right:0; left:0; bottom:0; width:100vw; max-height:88vh;
    border-radius:16px 16px 0 0; }
  .tsp-ask-fab { right:14px; bottom:14px; }
}
.tsp-ask-head {
  display:flex; align-items:center; gap:10px; padding:14px 16px;
  border-bottom:1px solid var(--ask-line); background:var(--ask-ink); color:#fff;
}
.tsp-ask-head b { font-size:16px; letter-spacing:.3px; }
.tsp-ask-tier {
  margin-left:auto; font-size:11px; font-weight:700; letter-spacing:.6px;
  text-transform:uppercase; padding:3px 9px; border-radius:999px;
  background:rgba(255,255,255,.14); color:#fff;
}
.tsp-ask-x {
  background:none; border:0; color:#fff; font-size:22px; line-height:1;
  cursor:pointer; padding:0 2px; opacity:.8;
}
.tsp-ask-x:hover { opacity:1; }
.tsp-ask-body { flex:1; overflow-y:auto; padding:14px 16px; -webkit-overflow-scrolling:touch; }
.tsp-ask-form { display:flex; gap:8px; padding:12px 16px; border-top:1px solid var(--ask-line); background:var(--ask-bg); }
.tsp-ask-form input {
  flex:1; min-width:0; padding:11px 13px; font:inherit; font-size:15px;
  border:1px solid var(--ask-line); border-radius:9px; background:#fff; color:var(--ask-ink);
}
.tsp-ask-form input:focus { outline:2px solid var(--ask-green); outline-offset:-1px; }
.tsp-ask-form button {
  padding:11px 17px; border:0; border-radius:9px; cursor:pointer;
  background:var(--ask-green); color:#12300a; font-weight:800; font-size:15px;
}
.tsp-ask-form button:disabled { opacity:.5; cursor:default; }
.tsp-ask-q { font-weight:700; margin:0 0 10px; }
.tsp-ask-a { font-size:15px; line-height:1.55; white-space:pre-wrap; margin:0 0 12px; }
.tsp-ask-note {
  font-size:13px; line-height:1.5; padding:10px 12px; border-radius:9px;
  background:var(--ask-amber-bg); color:var(--ask-amber); margin:0 0 12px;
}
.tsp-ask-rec {
  border:1px solid var(--ask-line); border-left:4px solid var(--ask-green);
  border-radius:9px; padding:11px 13px; margin:0 0 10px; background:var(--ask-green-bg);
}
.tsp-ask-rec h4 { margin:0 0 7px; font-size:14px; }
.tsp-ask-rec table { width:100%; border-collapse:collapse; font-size:13px; }
.tsp-ask-rec td { padding:3px 0; vertical-align:top; }
.tsp-ask-rec td:first-child { color:var(--ask-muted); padding-right:12px; white-space:nowrap; }
.tsp-ask-rec td:last-child { font-weight:700; font-variant-numeric:tabular-nums; text-align:right; }
.tsp-ask-rec .src { margin:7px 0 0; font-size:11px; color:var(--ask-muted); }
.tsp-ask-cites { margin:0; padding:0; list-style:none; border-top:1px solid var(--ask-line); padding-top:10px; }
.tsp-ask-cites li { margin:0 0 7px; font-size:13px; line-height:1.45; }
.tsp-ask-cites a { color:var(--ask-green-dk); font-weight:700; text-decoration:none; }
.tsp-ask-cites a:hover { text-decoration:underline; }
.tsp-ask-cites .where { color:var(--ask-muted); }
.tsp-ask-diag { margin:12px 0 0; font-size:11px; color:var(--ask-muted); }
.tsp-ask-diag summary { cursor:pointer; font-weight:700; }
.tsp-ask-diag table { width:100%; border-collapse:collapse; margin-top:7px; }
.tsp-ask-diag th { text-align:left; font-weight:700; padding:2px 6px 2px 0; }
.tsp-ask-diag td { padding:2px 6px 2px 0; vertical-align:top; }
.tsp-ask-diag td:first-child { font-variant-numeric:tabular-nums; }
.tsp-ask-foot { font-size:11px; color:var(--ask-muted); margin:12px 0 0; line-height:1.5; }
.tsp-ask-empty { color:var(--ask-muted); font-size:14px; line-height:1.6; }
.tsp-ask-empty ul { margin:9px 0 0; padding-left:18px; }
.tsp-ask-empty li { margin:0 0 6px; cursor:pointer; color:var(--ask-green-dk); }
.tsp-ask-empty li:hover { text-decoration:underline; }
.tsp-ask-spin { display:flex; align-items:center; gap:9px; color:var(--ask-muted); font-size:14px; }
.tsp-ask-spin i {
  width:15px; height:15px; border:2px solid var(--ask-line);
  border-top-color:var(--ask-green); border-radius:50%; display:inline-block;
  animation:tsp-ask-spin .7s linear infinite;
}
@keyframes tsp-ask-spin { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion:reduce) {
  .tsp-ask-fab, .tsp-ask-panel, .tsp-ask-scrim { transition:none; }
  .tsp-ask-spin i { animation-duration:2s; }
}
`;

  // ── helpers ───────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Pricing keys carry house vocabulary. "Floor" and "Base" are the words
  // Trinity uses; never "Min" or "Minimum" on a surface a rep reads.
  var FIELD_LABEL = {
    flat_rate: 'Flat rate', ppa_with_esc: 'PPA with escalator',
    rate_caps: 'Rate cap', base_ppw: 'Base PPW', minimum_ppw: 'Base PPW (floor check)',
    floor_ppw: 'Floor PPW', partner: 'Partner', state: 'State', utility: 'Utility'
  };
  var FIELD_ORDER = ['partner', 'state', 'utility', 'flat_rate', 'ppa_with_esc',
                     'rate_caps', 'base_ppw', 'floor_ppw'];

  function fmtVal(k, v) {
    if (v == null) return '--';
    if (typeof v !== 'number') return esc(v);
    // Never re-rounded: rounding a floor price is exactly how a wrong number
    // ends up quoted at a kitchen table. Padded UP to two decimals only, so
    // 3.0 reads as $3.00 next to $2.75 while 0.239 keeps its third decimal.
    // The unit is spelled out because $0.239 per kWh and $3.00 per watt look
    // alike at a glance and mean very different things.
    var s = String(v);
    var dec = s.indexOf('.') < 0 ? 0 : s.length - s.indexOf('.') - 1;
    if (dec < 2) s = v.toFixed(2);
    var unit = /rate|caps|esc/.test(k) ? ' /kWh' : (/ppw/.test(k) ? ' /W' : '');
    return '$' + s + unit;
  }

  function recordCard(rec) {
    var r = rec.record || {};
    var keys = FIELD_ORDER.filter(function (k) { return r[k] != null; });
    Object.keys(r).forEach(function (k) {
      if (keys.indexOf(k) < 0 && typeof r[k] !== 'object') keys.push(k);
    });
    var rows = keys.map(function (k) {
      return '<tr><td>' + esc(FIELD_LABEL[k] || k.replace(/_/g, ' ')) +
             '</td><td>' + fmtVal(k, r[k]) + '</td></tr>';
    }).join('');
    var src = [];
    if (rec.as_of) src.push('As of ' + esc(rec.as_of));
    if (rec.provenance) src.push(esc(rec.provenance));
    return '<div class="tsp-ask-rec"><h4>' + esc(rec.heading) + '</h4>' +
           '<table>' + rows + '</table>' +
           (src.length ? '<p class="src">' + src.join(' &middot; ') +
                         ' &middot; Operations Master Reference</p>' : '') +
           '</div>';
  }

  function citeList(cites) {
    if (!cites || !cites.length) return '';
    var items = cites.map(function (c) {
      var where = c.heading && c.heading !== c.page
        ? ' <span class="where">' + esc(c.heading) + '</span>' : '';
      var label = esc(c.page || c.source_label || 'Source');
      var body = c.url
        ? '<a href="' + esc(c.url) + '">' + label + '</a>'
        : '<strong>' + label + '</strong>' + (c.ref ? ' <span class="where">' + esc(c.ref) + '</span>' : '');
      return '<li>' + body + where + '</li>';
    }).join('');
    return '<ul class="tsp-ask-cites">' + items + '</ul>';
  }

  // ── mount ─────────────────────────────────────────────────────────────────
  var root, panel, body, input, submit, tierChip, lastFocus;

  function mount() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    root = document.createElement('div');
    root.className = 'tsp-ask';
    root.innerHTML =
      '<button class="tsp-ask-fab" type="button" aria-haspopup="dialog" ' +
              'aria-label="Ask a question">' +
        '<span class="dot"></span><span>Ask</span></button>' +
      '<div class="tsp-ask-scrim"></div>' +
      '<div class="tsp-ask-panel" role="dialog" aria-modal="true" aria-label="Ask">' +
        '<div class="tsp-ask-head"><b>ASK</b>' +
          '<span class="tsp-ask-tier" hidden></span>' +
          '<button class="tsp-ask-x" type="button" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="tsp-ask-body"></div>' +
        '<form class="tsp-ask-form">' +
          '<input type="text" autocomplete="off" enterkeyhint="send" ' +
                 'aria-label="Your question">' +
          '<button type="submit">Ask</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(root);

    panel    = root.querySelector('.tsp-ask-panel');
    body     = root.querySelector('.tsp-ask-body');
    input    = root.querySelector('.tsp-ask-form input');
    submit   = root.querySelector('.tsp-ask-form button');
    tierChip = root.querySelector('.tsp-ask-tier');

    input.placeholder = PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)];

    root.querySelector('.tsp-ask-fab').addEventListener('click', open);
    root.querySelector('.tsp-ask-x').addEventListener('click', close);
    root.querySelector('.tsp-ask-scrim').addEventListener('click', close);
    root.querySelector('.tsp-ask-form').addEventListener('submit', function (e) {
      e.preventDefault();
      run(input.value.trim());
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('open')) close();
    });

    showIdle();
  }

  function showIdle() {
    body.innerHTML =
      '<div class="tsp-ask-empty">Ask anything about how we sell, finance, ' +
      'price, or handle an objection. Answers come from Trinity\'s own ' +
      'training material and link back to it.' +
      '<ul>' + PLACEHOLDERS.map(function (p) {
        return '<li data-q="' + esc(p) + '">' + esc(p) + '</li>';
      }).join('') + '</ul></div>';
    body.querySelectorAll('li[data-q]').forEach(function (li) {
      li.addEventListener('click', function () {
        input.value = li.getAttribute('data-q');
        run(input.value);
      });
    });
  }

  function open() {
    lastFocus = document.activeElement;
    root.classList.add('open');
    setTimeout(function () { input.focus(); }, 60);
  }

  function close() {
    root.classList.remove('open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  async function token() {
    // auth-gate.js owns the session and exposes the Supabase client as
    // window.sb. Read the access token per request rather than caching it, so
    // a refresh mid-session does not leave the panel holding a stale one.
    try {
      if (!window.sb || !window.sb.auth) return null;
      var res = await window.sb.auth.getSession();
      return (res && res.data && res.data.session && res.data.session.access_token) || null;
    } catch (e) { return null; }
  }

  async function run(q) {
    if (!q) return;
    submit.disabled = true;
    body.innerHTML = '<p class="tsp-ask-q">' + esc(q) + '</p>' +
                     '<div class="tsp-ask-spin"><i></i><span>Looking through the material...</span></div>';

    var jwt = await token();
    if (!jwt) {
      body.innerHTML = '<p class="tsp-ask-note">Your session has expired. ' +
                       'Reload the page and sign in again.</p>';
      submit.disabled = false;
      return;
    }

    var data;
    try {
      var res = await fetch(API_BASE + '/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt },
        body: JSON.stringify({ q: q, page: location.pathname })
      });
      if (res.status === 403) {
        body.innerHTML = '<p class="tsp-ask-q">' + esc(q) + '</p>' +
          '<p class="tsp-ask-note">Your account is not set up to use Ask yet. ' +
          'Message Dan and he can switch it on.</p>';
        submit.disabled = false;
        return;
      }
      data = await res.json();
    } catch (e) {
      body.innerHTML = '<p class="tsp-ask-q">' + esc(q) + '</p>' +
        '<p class="tsp-ask-note">Could not reach the answer service. ' +
        'If you are on a weak signal, try again in a moment.</p>';
      submit.disabled = false;
      return;
    }

    render(q, data);
    submit.disabled = false;
    input.select();
  }

  function render(q, d) {
    var html = '<p class="tsp-ask-q">' + esc(q) + '</p>';

    if (d.tier) { tierChip.textContent = d.tier; tierChip.hidden = false; }

    if (!d.ok) {
      html += '<p class="tsp-ask-note">' + esc(d.error || 'Something went wrong.') + '</p>';
      body.innerHTML = html;
      return;
    }

    if (d.refused) {
      html += '<p class="tsp-ask-note">' + esc(d.reason) + '</p>';
      if (d.citations && d.citations.length) {
        html += '<p class="tsp-ask-foot">Closest things I found:</p>' + citeList(d.citations);
      }
      html += foot(d);
      body.innerHTML = html;
      return;
    }

    // The record card goes ABOVE the prose deliberately: for a pricing
    // question the record IS the answer and the prose is commentary.
    (d.records || []).forEach(function (r) { html += recordCard(r); });

    if (d.degraded) {
      html += '<p class="tsp-ask-note">' + esc(d.reason) + '</p>';
    } else if (d.answer) {
      html += '<p class="tsp-ask-a">' + esc(d.answer) + '</p>';
    }

    html += citeList(d.citations);
    html += diagnostics(d);
    html += foot(d);
    body.innerHTML = html;
  }

  // Admin-only. The server decides whether to send this; the panel just
  // renders whatever arrives, so a non-admin cannot reveal it client-side.
  function diagnostics(d) {
    if (!d.diagnostics) return '';
    var rows = (d.diagnostics.hits || []).map(function (x) {
      return '<tr><td>' + x.score.toFixed(2) + '</td><td>' + esc(x.source) +
             '</td><td>' + esc(x.page) + ' / ' + esc(x.heading) + '</td>' +
             '<td>' + esc((x.matched || []).join(' ')) + '</td></tr>';
    }).join('');
    return '<details class="tsp-ask-diag"><summary>Retrieval (coverage ' +
           d.diagnostics.coverage + ')</summary>' +
           '<table><tr><th>score</th><th>source</th><th>passage</th><th>matched</th></tr>' +
           rows + '</table></details>';
  }

  function foot(d) {
    var bits = [];
    if (d.searched) bits.push('Searched ' + esc(d.searched) + '.');
    if (d.not_indexed && d.not_indexed.length) {
      bits.push('Not indexed yet: ' + esc(d.not_indexed.join(', ')) + '.');
    }
    bits.push('Answers come from Trinity material. Open the source before you quote it.');
    return '<p class="tsp-ask-foot">' + bits.join(' ') + '</p>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();

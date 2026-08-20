/* onboarding-gate.js -- first-login setup completion nudge/gate for reps.
 *
 * Self-injected by auth-gate.js (see the injection block right after the
 * site-nav.js one) for signed-in reps only -- window.IS_REP is checked
 * BEFORE this file is even fetched, so by the time this file's top-level
 * code runs, window.AUTH_PROFILE / window.sb are already set.
 *
 * Backend contract (already deployed, live against Supabase project
 * qjcozskyopetvigjhlmh): sb.rpc('get_my_onboarding_gate') -- no args,
 * self-scoped via the caller's JWT. Returns a single jsonb object:
 *
 *   { action: 'clear' | 'nudge' | 'block_core' | 'block_all',
 *     strength?: 'hard' | 'deadline' | 'nudge',
 *     missing?: string[],
 *     completeness?: { core_done, core_total, secondary_done,
 *                       secondary_total, missing: string[] },
 *     grace_until?: ISO timestamp,
 *     degraded?: true }
 *
 * `missing` entries are short keys: 'phone' | 'address' | 'disc' | 'photo'
 * | 'bio'. The RPC never rejects for a legitimate signed-in caller -- it
 * fails open to {action:'clear'} on any internal problem. A network
 * failure, or window.sb not being available, is also treated as 'clear'
 * here: never block the UI because the gate check itself failed.
 *
 * Public surface:
 *   window.OnboardingGate = { state, refresh() }
 *     state   -- the latest known gate response (null until the first
 *                resolution, or the cached value if a fresh cache exists).
 *     refresh -- bypasses the sessionStorage cache, re-fetches, re-renders,
 *                re-dispatches the ready event below.
 *
 *   document event 'onboardinggate:ready' (detail = the state object) --
 *     fired on initial load, on a cache hit, and after every refresh().
 *     Consumers that run before this script has resolved (e.g. me/index.html
 *     rendering on page load) should check window.OnboardingGate.state first
 *     and listen for this event once if it's still null.
 *
 * Rendering, by action:
 *   'clear'                -- remove any existing gate DOM, render nothing.
 *   'nudge'                -- small dismissible corner card (bottom-right).
 *                              Dismissal is sessionStorage, per browser tab
 *                              session only -- NOT rep_action_dismissals
 *                              (that table is dismiss-forever, which would
 *                              permanently silence what's meant to be an
 *                              escalating reminder).
 *   'block_core'/'block_all' -- full-viewport blocking overlay, no dismiss.
 *                              Downgraded to the nudge treatment on
 *                              GATE_EXEMPT_PATHS (/me/, the DISC assessment
 *                              page) so a rep is never blocked from reaching
 *                              the pages that let them clear the gate.
 */
(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────
  var CACHE_KEY = 'ct_onboarding_gate';
  var CACHE_FRESH_MS = 3 * 60 * 1000; // 3 minutes
  var NUDGE_DISMISS_KEY = 'ct_onboarding_nudge_dismissed';

  // Between site-nav.js's pill cluster (2147483000) and auth-gate.js's
  // fatal-error / access-denied overlays (2147483647).
  var Z_NUDGE = 2147483200;
  var Z_BLOCK = 2147483600;

  // Pages a rep must always be able to reach to actually clear the gate.
  // A block here would be a deadlock, not a feature.
  var GATE_EXEMPT_PATHS = ['/me/', '/university/disc-assessment.html'];

  var MISSING_LABELS = {
    phone: 'your phone number',
    address: 'your home address',
    disc: 'your DISC assessment',
    photo: 'a profile photo',
    bio: 'a bit about yourself'
  };

  // ── Small helpers ───────────────────────────────────────────────────
  function isExemptPath() {
    var path = location.pathname;
    for (var i = 0; i < GATE_EXEMPT_PATHS.length; i++) {
      if (path.indexOf(GATE_EXEMPT_PATHS[i]) === 0) return true;
    }
    return false;
  }

  function gateMissingList(state) {
    if (!state) return [];
    if (state.completeness && Array.isArray(state.completeness.missing)) {
      return state.completeness.missing;
    }
    if (Array.isArray(state.missing)) return state.missing;
    return [];
  }

  function humanizeList(missing) {
    var labels = [];
    for (var i = 0; i < (missing || []).length; i++) {
      var label = MISSING_LABELS[missing[i]];
      if (label) labels.push(label);
    }
    if (!labels.length) return 'a few profile details';
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return labels[0] + ' and ' + labels[1];
    return labels.slice(0, -1).join(', ') + ', and ' + labels[labels.length - 1];
  }

  function isNudgeDismissed() {
    try { return sessionStorage.getItem(NUDGE_DISMISS_KEY) === '1'; }
    catch (e) { return false; }
  }
  function setNudgeDismissed() {
    try { sessionStorage.setItem(NUDGE_DISMISS_KEY, '1'); } catch (e) {}
  }

  // ── sessionStorage cache ────────────────────────────────────────────
  function readCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.state) return null;
      return parsed;
    } catch (e) { return null; }
  }
  function writeCache(state) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ state: state, fetchedAt: Date.now() }));
    } catch (e) {}
  }

  // ── RPC fetch (fail-open) ───────────────────────────────────────────
  function fetchGateState(cb) {
    var sbClient = window.sb;
    if (!sbClient || typeof sbClient.rpc !== 'function') { cb({ action: 'clear' }); return; }
    sbClient.rpc('get_my_onboarding_gate').then(function (res) {
      if (res && res.error) { cb({ action: 'clear' }); return; }
      var data = res && res.data;
      if (!data || typeof data !== 'object') { cb({ action: 'clear' }); return; }
      cb(data);
    }).catch(function () {
      cb({ action: 'clear' });
    });
  }

  // ── DOM: corner nudge ───────────────────────────────────────────────
  function removeNudge() {
    var el = document.getElementById('ctOnboardingNudge');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function buildNudgeDom(state) {
    if (document.getElementById('ctOnboardingNudge')) return;
    var missing = gateMissingList(state);
    var discMissing = missing.indexOf('disc') !== -1;
    var o = document.createElement('div');
    o.id = 'ctOnboardingNudge';
    o.setAttribute('role', 'status');
    o.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:' + Z_NUDGE + ';'
      + 'max-width:300px;background:#131c2e;color:#e8ecf4;border:1px solid #29384f;'
      + 'border-radius:14px;padding:16px 18px;box-shadow:0 10px 30px rgba(11,17,32,.45);'
      + 'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;';
    var body = missing.length
      ? ('You still need to add ' + humanizeList(missing) + '.')
      : 'A few details on your profile still need attention.';
    var linksHtml = '<a href="/me/" style="color:#78C832;text-decoration:none;font-weight:700;">Go to My Page</a>';
    if (discMissing) {
      linksHtml += ' &middot; <a href="/university/disc-assessment.html" '
        + 'style="color:#78C832;text-decoration:none;font-weight:700;">Take your DISC</a>';
    }
    o.innerHTML =
      '<button id="ctOnboardingNudgeClose" type="button" aria-label="Dismiss" '
      + 'style="position:absolute;top:8px;right:10px;background:none;border:none;color:#a9b6cc;'
      + 'font-size:16px;line-height:1;cursor:pointer;padding:4px;">&times;</button>'
      + '<div style="font-size:13px;font-weight:700;color:#78C832;letter-spacing:.04em;'
      + 'text-transform:uppercase;margin-bottom:6px;padding-right:20px;">Finish setting up your profile</div>'
      + '<div style="font-size:13px;line-height:1.5;color:#c7cfdd;margin-bottom:12px;">' + body + '</div>'
      + '<div style="font-size:13px;">' + linksHtml + '</div>';
    document.body.appendChild(o);
    var closeBtn = document.getElementById('ctOnboardingNudgeClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        setNudgeDismissed();
        removeNudge();
      });
    }
  }

  function renderNudge(state) {
    if (isNudgeDismissed()) return;
    if (document.body) buildNudgeDom(state);
    else document.addEventListener('DOMContentLoaded', function () { buildNudgeDom(state); });
  }

  // ── DOM: full-viewport block ────────────────────────────────────────
  function removeBlock() {
    var el = document.getElementById('ctOnboardingBlock');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function buildBlockDom(state, action) {
    if (document.getElementById('ctOnboardingBlock')) return;
    var missing = gateMissingList(state);
    var discMissing = missing.indexOf('disc') !== -1;
    var urgent = action === 'block_all';
    var heading = urgent
      ? 'Your profile setup needs to be finished'
      : 'Finish setting up your profile to continue';
    var body = urgent
      ? 'Some required details on your profile are still missing. Finish these before you can keep using the site.'
      : "A couple of quick details are still missing from your profile. Add them and you're back in.";
    var missingLine = missing.length ? ('Still needed: ' + humanizeList(missing) + '.') : '';
    var linksHtml = '<a href="/me/" style="display:inline-block;background:#78C832;color:#0b1120;'
      + 'text-decoration:none;border-radius:10px;padding:11px 22px;font-size:14px;font-weight:700;">Go to My Page</a>';
    if (discMissing) {
      linksHtml += '<a href="/university/disc-assessment.html" style="display:inline-block;background:transparent;'
        + 'color:#78C832;border:1px solid #29384f;text-decoration:none;border-radius:10px;padding:10px 21px;'
        + 'font-size:14px;font-weight:700;margin-left:10px;">Take your DISC</a>';
    }
    var o = document.createElement('div');
    o.id = 'ctOnboardingBlock';
    o.setAttribute('role', 'alert');
    o.style.cssText = 'position:fixed;inset:0;z-index:' + Z_BLOCK + ';display:flex;'
      + 'align-items:center;justify-content:center;background:#0b1120;'
      + 'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;';
    o.innerHTML =
      '<div style="max-width:440px;text-align:center;color:#e8ecf4;'
      + 'background:#131c2e;border:1px solid #29384f;border-radius:16px;padding:32px 28px;">'
      + '<div style="font-size:13px;font-weight:700;color:#78C832;letter-spacing:.06em;'
      + 'text-transform:uppercase;margin-bottom:12px;">Current</div>'
      + '<div style="font-size:18px;font-weight:700;margin-bottom:8px;">' + heading + '</div>'
      + '<div style="font-size:14px;line-height:1.55;color:#a9b6cc;margin-bottom:8px;">' + body + '</div>'
      + '<div style="font-size:13px;line-height:1.5;color:#8b96a8;margin-bottom:20px;">' + missingLine + '</div>'
      + '<div>' + linksHtml + '</div></div>';
    document.body.appendChild(o);
  }

  function renderBlock(state, action) {
    if (document.body) buildBlockDom(state, action);
    else document.addEventListener('DOMContentLoaded', function () { buildBlockDom(state, action); });
  }

  // ── Render dispatch ─────────────────────────────────────────────────
  function render(state) {
    removeNudge();
    removeBlock();
    if (!state) return;
    var action = state.action;
    if ((action === 'block_core' || action === 'block_all') && isExemptPath()) {
      action = 'nudge'; // never block a rep from reaching the pages that clear the gate
    }
    if (action === 'nudge') {
      renderNudge(state);
    } else if (action === 'block_core' || action === 'block_all') {
      renderBlock(state, action);
    }
    // 'clear' or any unrecognized action -> nothing rendered (fail open).
  }

  // ── State + public surface ──────────────────────────────────────────
  function setState(state) {
    if (window.OnboardingGate) window.OnboardingGate.state = state;
    try { render(state); }
    catch (e) { try { console.warn('[onboarding-gate] render failed:', e); } catch (e2) {} }
    try { document.dispatchEvent(new CustomEvent('onboardinggate:ready', { detail: state })); }
    catch (e) {}
  }

  function refresh() {
    fetchGateState(function (fresh) {
      writeCache(fresh);
      setState(fresh);
    });
  }

  window.OnboardingGate = { state: null, refresh: refresh };

  // ── Boot ────────────────────────────────────────────────────────────
  (function init() {
    var cached = readCache();
    if (cached && (Date.now() - cached.fetchedAt) < CACHE_FRESH_MS) {
      setState(cached.state); // render immediately from cache
      fetchGateState(function (fresh) {           // stale-while-revalidate
        writeCache(fresh);
        setState(fresh);
      });
    } else {
      fetchGateState(function (fresh) {
        writeCache(fresh);
        setState(fresh);
      });
    }
  })();
})();

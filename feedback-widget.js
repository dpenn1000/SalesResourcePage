/**
 * Sitewide Feedback widget for ct-resource-page.com.
 *
 * Drop-in: <script src="/feedback-widget.js" defer></script>
 *
 * Renders a floating "Feedback" button in the bottom-right that opens a
 * modal letting any user submit an improvement, content request, bug,
 * or other note. Captures browser/device info automatically; offers an
 * opt-in "Attach screenshot" button (lazy-loads html2canvas) and a
 * file-attach picker.
 *
 * Submissions go to the public.feedback_items table via Supabase REST.
 * Attachments go to the feedback-attachments storage bucket. RLS
 * (migration 0004) allows anon insert and public storage write; only
 * authenticated admins can read/triage from the admin Feedback tab.
 *
 * No dependencies beyond optional html2canvas (CDN, lazy).
 */
(function () {
  'use strict';

  // --- config ---
  const SUPABASE_URL = 'https://qjcozskyopetvigjhlmh.supabase.co';
  // Publishable anon key (read in admin.html the same way; safe in client).
  const SUPABASE_ANON_KEY = 'sb_publishable_tBchDunvDSIU2e5L7KIzWA_G1og1Ru2';
  const HTML2CANVAS_CDN = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  const STORAGE_BUCKET = 'feedback-attachments';
  const REST = SUPABASE_URL + '/rest/v1';
  const STORAGE = SUPABASE_URL + '/storage/v1/object';
  const MAX_FILE_BYTES = 10 * 1024 * 1024; // matches bucket limit

  // --- guard against double inject ---
  if (window.__dialecta_feedback_loaded__) return;
  window.__dialecta_feedback_loaded__ = true;

  // --- error ring buffer ---
  // Captures window errors, unhandled promise rejections, and console.error
  // / console.warn calls for the lifetime of the page. Always on (small
  // overhead). Attached to every submission as device_info.errors so the
  // admin detail modal can surface them. Only catches things that happen
  // AFTER this widget loads (defer); earlier errors are missed unless we
  // ship an inline bootstrap in <head>.
  const ERROR_LOG_MAX = 50;
  const errorLog = [];
  function pushErr(entry) {
    entry.t = Date.now();
    errorLog.push(entry);
    if (errorLog.length > ERROR_LOG_MAX) errorLog.shift();
  }
  function safeStr(x, max = 500) {
    try {
      if (x == null) return String(x);
      if (typeof x === 'string') return x.slice(0, max);
      if (typeof x === 'object') return JSON.stringify(x).slice(0, max);
      return String(x).slice(0, max);
    } catch { return '[unserializable]'; }
  }
  window.addEventListener('error', function (e) {
    pushErr({
      kind: 'error',
      message: safeStr(e.message),
      source: e.filename || null,
      line: e.lineno || null,
      col: e.colno || null,
      stack: (e.error && e.error.stack) ? safeStr(e.error.stack, 1500) : null,
    });
  });
  window.addEventListener('unhandledrejection', function (e) {
    const r = e.reason;
    pushErr({
      kind: 'unhandledrejection',
      reason: safeStr(r && r.message ? r.message : r),
      stack: (r && r.stack) ? safeStr(r.stack, 1500) : null,
    });
  });
  // Lightweight console.error / console.warn wrap. Preserves original output
  // so other tooling still sees them.
  ['error', 'warn'].forEach(function (level) {
    const orig = console[level];
    console[level] = function () {
      try {
        const args = Array.prototype.slice.call(arguments).map(a => safeStr(a, 400));
        pushErr({ kind: 'console.' + level, args });
      } catch {}
      return orig.apply(console, arguments);
    };
  });

  // --- styles ---
  const css = `
  .fbw-fab {
    position: fixed; right: 18px; bottom: 18px; z-index: 9998;
    background: #1A2332; color: #fff;
    padding: 10px 16px; border: none; border-radius: 999px;
    font: 600 13px/1 'Manrope', system-ui, sans-serif;
    cursor: pointer; box-shadow: 0 6px 16px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.05);
    display: inline-flex; align-items: center; gap: 8px;
    letter-spacing: 0.02em;
    transition: transform 120ms, box-shadow 120ms, background 120ms;
  }
  .fbw-fab:hover { background: #29A9E1; transform: translateY(-1px); box-shadow: 0 10px 20px rgba(0,0,0,0.22); }
  .fbw-fab svg { width: 16px; height: 16px; }

  .fbw-overlay {
    position: fixed; inset: 0; background: rgba(11,17,32,0.55);
    display: none; z-index: 9999; align-items: center; justify-content: center;
    padding: 16px; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  }
  .fbw-overlay.open { display: flex; }
  .fbw-modal {
    background: #fefcf5; color: #1A2332; max-width: 540px; width: 100%;
    max-height: 90vh; overflow: auto; border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.04);
    font-family: 'Manrope', system-ui, sans-serif; font-size: 14px; line-height: 1.5;
  }
  .fbw-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 22px 12px; border-bottom: 1px solid #DFE2DA;
  }
  .fbw-head h2 {
    font-family: 'Fraunces', Georgia, serif; font-size: 22px;
    margin: 0; color: #0b1120; font-weight: 700;
  }
  .fbw-head h2 span { color: #5eba28; }
  .fbw-close {
    background: transparent; border: none; cursor: pointer;
    font-size: 20px; color: #6b7a90; line-height: 1; padding: 4px 8px;
    border-radius: 6px;
  }
  .fbw-close:hover { background: #EFF1EC; color: #1A2332; }

  .fbw-body { padding: 16px 22px 4px; }
  .fbw-body p.lede { margin: 0 0 14px; color: #2a3340; font-size: 13.5px; }

  .fbw-field { margin-bottom: 14px; }
  .fbw-field label {
    display: block; font-size: 11.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.05em;
    color: #1A2332; margin-bottom: 5px;
  }
  .fbw-field input[type=text], .fbw-field input[type=email], .fbw-field textarea {
    width: 100%; box-sizing: border-box;
    padding: 9px 11px; font: inherit;
    border: 1px solid #DFE2DA; border-radius: 8px;
    background: #fff; color: #1A2332;
    transition: border-color 100ms, box-shadow 100ms;
  }
  .fbw-field input:focus, .fbw-field textarea:focus {
    outline: none; border-color: #78C832;
    box-shadow: 0 0 0 3px rgba(120,200,50,0.18);
  }
  .fbw-field textarea { min-height: 100px; resize: vertical; font-family: inherit; }

  .fbw-types {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 6px;
  }
  .fbw-type {
    border: 1px solid #DFE2DA; background: #fff; border-radius: 8px;
    padding: 9px 10px; cursor: pointer; font: 500 13px 'Manrope';
    color: #1A2332; text-align: center; transition: all 120ms;
  }
  .fbw-type:hover { border-color: #78C832; }
  .fbw-type[aria-pressed="true"] {
    background: #1A2332; color: #fff; border-color: #1A2332;
  }
  .fbw-type b { display: block; font-weight: 700; }
  .fbw-type small { display: block; opacity: 0.7; font-size: 11px; margin-top: 2px; }

  .fbw-attachments {
    display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;
  }
  .fbw-attach-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 11px; font: 500 12.5px 'Manrope';
    background: #fff; border: 1px solid #DFE2DA; border-radius: 8px;
    color: #1A2332; cursor: pointer;
  }
  .fbw-attach-btn:hover { border-color: #29A9E1; background: rgba(41,169,225,0.05); }
  .fbw-attach-btn[disabled] { opacity: 0.55; cursor: progress; }
  .fbw-attach-btn svg { width: 13px; height: 13px; }

  .fbw-attached-list { display: grid; gap: 4px; margin-top: 8px; }
  .fbw-attached-item {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 9px; font-size: 12.5px;
    background: #EFF1EC; border-radius: 6px;
  }
  .fbw-attached-item .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fbw-attached-item .size { color: #6b7a90; font-size: 11px; }
  .fbw-attached-item button {
    background: transparent; border: none; cursor: pointer;
    color: #b04040; font-size: 16px; line-height: 1; padding: 0 4px;
  }

  .fbw-foot {
    display: flex; gap: 8px; justify-content: flex-end;
    padding: 14px 22px 18px; border-top: 1px solid #DFE2DA;
    background: #f9f6ed; border-radius: 0 0 16px 16px;
  }
  .fbw-btn {
    padding: 10px 16px; font: 600 13px 'Manrope';
    border-radius: 8px; cursor: pointer; border: none;
    transition: all 120ms;
  }
  .fbw-btn-cancel { background: transparent; color: #6b7a90; }
  .fbw-btn-cancel:hover { background: #EFF1EC; color: #1A2332; }
  .fbw-btn-submit {
    background: #5eba28; color: #fff;
    box-shadow: 0 1px 0 rgba(0,0,0,0.05), 0 4px 12px rgba(94,186,40,0.25);
  }
  .fbw-btn-submit:hover { background: #4ea120; }
  .fbw-btn-submit[disabled] { opacity: 0.55; cursor: progress; }

  .fbw-error {
    background: #fbe1e1; color: #843636;
    border: 1px solid #e09a9a; border-radius: 8px;
    padding: 8px 12px; font-size: 12.5px; margin-top: 8px;
    display: none;
  }
  .fbw-error.open { display: block; }

  .fbw-success {
    padding: 32px 22px; text-align: center;
  }
  .fbw-success svg {
    width: 56px; height: 56px; color: #5eba28; margin-bottom: 12px;
  }
  .fbw-success h2 {
    font-family: 'Fraunces', Georgia, serif; margin: 0 0 8px;
    font-size: 22px; color: #0b1120; font-weight: 700;
  }
  .fbw-success p { color: #2a3340; margin: 0 0 4px; }

  .fbw-meta {
    margin-top: 14px; padding-top: 12px; border-top: 1px dashed #DFE2DA;
    font-size: 11px; color: #6b7a90;
  }
  .fbw-meta summary { cursor: pointer; }
  .fbw-meta pre {
    background: #f1f3ee; padding: 8px; border-radius: 6px;
    font: 11px/1.4 'DM Mono', ui-monospace, monospace;
    overflow: auto; max-height: 160px; margin: 6px 0 0;
  }

  @media (max-width: 540px) {
    .fbw-fab { right: 12px; bottom: 12px; padding: 9px 14px; font-size: 12.5px; }
    .fbw-modal { border-radius: 12px; }
    .fbw-head, .fbw-body, .fbw-foot { padding-left: 16px; padding-right: 16px; }
  }
  `;

  // --- collect device snapshot ---
  function collectDeviceInfo() {
    const nav = navigator || {};
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection || {};
    const orient = (screen.orientation || {}).type || null;
    return {
      user_agent: nav.userAgent || null,
      platform: nav.platform || null,
      vendor: nav.vendor || null,
      language: nav.language || null,
      languages: nav.languages || null,
      online: nav.onLine ?? null,
      hardware_concurrency: nav.hardwareConcurrency ?? null,
      device_memory: nav.deviceMemory ?? null,
      max_touch_points: nav.maxTouchPoints ?? null,
      cookie_enabled: nav.cookieEnabled ?? null,
      do_not_track: nav.doNotTrack ?? null,
      viewport: {
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
      },
      screen: {
        w: screen.width, h: screen.height,
        avail_w: screen.availWidth, avail_h: screen.availHeight,
        color_depth: screen.colorDepth, pixel_depth: screen.pixelDepth,
        orientation: orient,
      },
      timezone: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || null,
      timezone_offset_min: new Date().getTimezoneOffset(),
      prefers_color_scheme:
        window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      prefers_reduced_motion:
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      connection: {
        effective_type: conn.effectiveType || null,
        downlink: conn.downlink ?? null,
        rtt: conn.rtt ?? null,
        save_data: conn.saveData ?? null,
        type: conn.type || null,
      },
      page_url: location.href,
      page_title: document.title,
      referrer: document.referrer || null,
      submitted_at_iso: new Date().toISOString(),
      build_version: document.querySelector('meta[name="build-version"]')?.content || null,
      // Snapshot the error ring buffer (last 50 entries since page load).
      // Empty array if the page is healthy. Truncated entries are already
      // safe-stringified by safeStr().
      errors: errorLog.slice(-ERROR_LOG_MAX),
    };
  }

  // --- lazy-load html2canvas for screenshot ---
  let h2cPromise = null;
  function loadHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    if (h2cPromise) return h2cPromise;
    h2cPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = HTML2CANVAS_CDN;
      s.onload = () => resolve(window.html2canvas);
      s.onerror = () => reject(new Error('Failed to load screenshot library'));
      document.head.appendChild(s);
    });
    return h2cPromise;
  }

  // --- supabase calls ---
  async function uploadAttachment(file) {
    // Random path to avoid collisions; preserve original name in stored metadata
    const ext = file.name.split('.').pop().toLowerCase();
    const safeExt = /^[a-z0-9]{1,10}$/.test(ext) ? ext : 'bin';
    const path = 'submissions/' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.' + safeExt;
    const url = STORAGE + '/' + STORAGE_BUCKET + '/' + path;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'false',
      },
      body: file,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => res.statusText);
      throw new Error('Upload failed: ' + t.slice(0, 200));
    }
    return {
      name: file.name,
      url: SUPABASE_URL + '/storage/v1/object/public/' + STORAGE_BUCKET + '/' + path,
      size: file.size,
      type: file.type || 'application/octet-stream',
    };
  }

  async function submitFeedback(payload) {
    // Feedback is no longer anonymous. RLS requires authenticated insert with
    // non-null submitter_name + submitter_email -- both pulled from the
    // signed-in user's session.
    const session = window.AUTH_SESSION;
    if (!session) throw new Error('Not signed in. Refresh and sign in to submit feedback.');
    const res = await fetch(REST + '/feedback_items', {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + session.access_token,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => res.statusText);
      throw new Error('Submit failed: ' + t.slice(0, 200));
    }
  }

  // --- DOM ---
  function injectStyles() {
    const s = document.createElement('style');
    s.id = 'fbw-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  const TYPES = [
    { id: 'improvement',     label: 'Improvement',    sub: 'Make this better' },
    { id: 'content_request', label: 'Content',        sub: 'Add or update' },
    { id: 'bug',             label: 'Bug',            sub: "Something's broken" },
    { id: 'other',           label: 'Other',          sub: 'Open feedback' },
  ];

  let attached = []; // {name, url, size, type}
  let currentType = 'improvement';

  function buildModal() {
    const overlay = document.createElement('div');
    overlay.className = 'fbw-overlay';
    overlay.innerHTML = `
      <div class="fbw-modal" role="dialog" aria-modal="true" aria-labelledby="fbw-title">
        <div class="fbw-head">
          <h2 id="fbw-title">Send <span>feedback</span></h2>
          <button class="fbw-close" aria-label="Close" data-fbw-close>×</button>
        </div>
        <div class="fbw-body" data-fbw-form>
          <p class="lede">Spotted something off, want a feature, or have content to add? Tell us. Your browser/device info attaches automatically.</p>

          <div class="fbw-field">
            <label>What kind of feedback?</label>
            <div class="fbw-types" data-fbw-types></div>
          </div>

          <div class="fbw-field">
            <label for="fbw-title-in">Short summary</label>
            <input type="text" id="fbw-title-in" maxlength="160" placeholder="e.g. Pricing table doesn't sort by state on iPad">
          </div>

          <div class="fbw-field">
            <label for="fbw-body-in">Details</label>
            <textarea id="fbw-body-in" maxlength="4000" placeholder="What were you trying to do, what happened, what would you expect?"></textarea>
          </div>

          <div class="fbw-field">
            <label>Submitting as</label>
            <div data-fbw-who style="padding:9px 11px;background:#EFF1EC;border:1px solid #DFE2DA;border-radius:8px;font-size:13px;color:#1A2332">--</div>
            <p style="font-size:11px;color:#6b7a90;margin-top:5px">Your name + sign-in handle are attached automatically. No anonymous feedback.</p>
          </div>

          <div class="fbw-field">
            <label>Attachments <span style="font-weight:500;text-transform:none;color:#6b7a90;">(optional, max 10 MB each)</span></label>
            <div class="fbw-attachments">
              <button type="button" class="fbw-attach-btn" data-fbw-screenshot>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M3 14l4-4 4 4 6-6 4 4"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/></svg>
                Capture screenshot
              </button>
              <label class="fbw-attach-btn" style="margin:0;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
                Attach file
                <input type="file" accept="image/*,application/pdf,text/plain" hidden data-fbw-file>
              </label>
            </div>
            <div class="fbw-attached-list" data-fbw-attached></div>
          </div>

          <details class="fbw-meta">
            <summary>What gets sent automatically?</summary>
            <pre data-fbw-meta-pre></pre>
          </details>

          <div class="fbw-error" data-fbw-error></div>
        </div>

        <div class="fbw-foot" data-fbw-foot>
          <button class="fbw-btn fbw-btn-cancel" data-fbw-close>Cancel</button>
          <button class="fbw-btn fbw-btn-submit" data-fbw-submit>Send feedback</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function renderTypes(host) {
    host.innerHTML = TYPES.map(t =>
      `<button type="button" class="fbw-type" data-fbw-type="${t.id}" aria-pressed="${t.id === currentType ? 'true' : 'false'}">
        <b>${t.label}</b><small>${t.sub}</small>
      </button>`
    ).join('');
    host.querySelectorAll('[data-fbw-type]').forEach(b => {
      b.addEventListener('click', () => {
        currentType = b.dataset.fbwType;
        host.querySelectorAll('[data-fbw-type]').forEach(x =>
          x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      });
    });
  }

  function renderAttached(host) {
    host.innerHTML = attached.map((a, i) =>
      `<div class="fbw-attached-item">
        <span class="name">${a.name.replace(/[<>"']/g, '')}</span>
        <span class="size">${(a.size/1024).toFixed(0)} KB</span>
        <button type="button" data-fbw-remove="${i}" aria-label="Remove">×</button>
      </div>`
    ).join('');
    host.querySelectorAll('[data-fbw-remove]').forEach(b => {
      b.addEventListener('click', () => {
        attached.splice(parseInt(b.dataset.fbwRemove, 10), 1);
        renderAttached(host);
      });
    });
  }

  function showError(host, msg) {
    host.textContent = msg;
    host.classList.add('open');
  }
  function clearError(host) { host.classList.remove('open'); host.textContent = ''; }

  // --- main ---
  function waitForAuth(cb) {
    // Inject the FAB only after the user is signed in. Pages on this site
    // are auth-gated by /auth-gate.js, which sets window.AUTH_PROFILE +
    // window.AUTH_SESSION after the role check passes. Without that, the
    // feedback insert would fail RLS (Migration I: non-anon feedback only).
    if (window.AUTH_PROFILE && window.AUTH_SESSION) return cb();
    const iv = setInterval(() => {
      if (window.AUTH_PROFILE && window.AUTH_SESSION) {
        clearInterval(iv);
        cb();
      }
    }, 300);
    // Give up after 60s to avoid leaking an interval on pages without auth-gate.
    setTimeout(() => clearInterval(iv), 60000);
  }

  function init() {
    injectStyles();
    waitForAuth(() => initSignedIn());
  }

  function initSignedIn() {
    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'fbw-fab';
    fab.setAttribute('aria-label', 'Send feedback');
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>Feedback';
    document.body.appendChild(fab);

    const overlay = buildModal();
    const typesHost = overlay.querySelector('[data-fbw-types]');
    const attachedHost = overlay.querySelector('[data-fbw-attached]');
    const fileInput = overlay.querySelector('[data-fbw-file]');
    const errBox = overlay.querySelector('[data-fbw-error]');
    const titleIn = overlay.querySelector('#fbw-title-in');
    const bodyIn = overlay.querySelector('#fbw-body-in');
    const whoEl = overlay.querySelector('[data-fbw-who]');
    const submitBtn = overlay.querySelector('[data-fbw-submit]');
    const screenshotBtn = overlay.querySelector('[data-fbw-screenshot]');
    const metaPre = overlay.querySelector('[data-fbw-meta-pre]');

    renderTypes(typesHost);
    renderAttached(attachedHost);

    function open() {
      overlay.classList.add('open');
      metaPre.textContent = JSON.stringify(collectDeviceInfo(), null, 2);
      const p = window.AUTH_PROFILE;
      const s = window.AUTH_SESSION;
      if (whoEl) {
        whoEl.textContent = p && s
          ? `${p.name} (${s.user.email})`
          : 'Not signed in -- refresh and sign in to submit.';
      }
      setTimeout(() => titleIn.focus(), 10);
    }
    function close() {
      overlay.classList.remove('open');
      // reset form
      currentType = 'improvement';
      attached = [];
      titleIn.value = '';
      bodyIn.value = '';
      clearError(errBox);
      renderTypes(typesHost);
      renderAttached(attachedHost);
      // restore submit button if we left it in success state
      const foot = overlay.querySelector('[data-fbw-foot]');
      const formBody = overlay.querySelector('[data-fbw-form]');
      if (foot) foot.style.display = '';
      if (formBody) formBody.style.display = '';
      const success = overlay.querySelector('.fbw-success');
      if (success) success.remove();
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send feedback';
    }

    fab.addEventListener('click', open);
    // Let any page open the feedback form via a link (#feedback) or
    // programmatically (window.openFeedback()), not just the corner button.
    window.openFeedback = open;
    if ((location.hash || '').toLowerCase() === '#feedback') setTimeout(open, 60);
    window.addEventListener('hashchange', () => {
      if ((location.hash || '').toLowerCase() === '#feedback') open();
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) close();
      if (e.target.closest('[data-fbw-close]')) close();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });

    // file picker
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files[0];
      fileInput.value = '';
      if (!f) return;
      if (f.size > MAX_FILE_BYTES) {
        showError(errBox, 'File too large (' + (f.size/1024/1024).toFixed(1) + ' MB). Max 10 MB.');
        return;
      }
      clearError(errBox);
      try {
        const a = await uploadAttachment(f);
        attached.push(a);
        renderAttached(attachedHost);
      } catch (err) {
        showError(errBox, err.message);
      }
    });

    // screenshot capture
    screenshotBtn.addEventListener('click', async () => {
      screenshotBtn.disabled = true;
      const oldText = screenshotBtn.innerHTML;
      screenshotBtn.innerHTML = 'Capturing...';
      clearError(errBox);
      try {
        const h2c = await loadHtml2Canvas();
        // Hide our overlay during capture so the screenshot reflects the page
        overlay.style.display = 'none';
        await new Promise(r => setTimeout(r, 30));
        const canvas = await h2c(document.body, {
          useCORS: true, allowTaint: true,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          scale: Math.min(window.devicePixelRatio || 1, 2),
        });
        overlay.style.display = '';
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        if (!blob) throw new Error('Could not produce image');
        const file = new File([blob], 'screenshot-' + Date.now() + '.png', { type: 'image/png' });
        if (file.size > MAX_FILE_BYTES) {
          throw new Error('Screenshot too large; try cropping or zooming out');
        }
        const a = await uploadAttachment(file);
        attached.push(a);
        renderAttached(attachedHost);
      } catch (err) {
        showError(errBox, 'Screenshot failed: ' + (err.message || err));
      } finally {
        overlay.style.display = '';
        screenshotBtn.disabled = false;
        screenshotBtn.innerHTML = oldText;
      }
    });

    // submit
    submitBtn.addEventListener('click', async () => {
      clearError(errBox);
      const title = titleIn.value.trim();
      const body = bodyIn.value.trim();
      if (!title && !body) {
        showError(errBox, 'Add a summary or details (one or the other is fine).');
        return;
      }
      const profile = window.AUTH_PROFILE;
      const session = window.AUTH_SESSION;
      if (!profile || !session) {
        showError(errBox, 'Your session expired. Refresh the page and sign in again.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      const payload = {
        type: currentType,
        title: title || (body ? body.slice(0, 80) : ''),
        body: body,
        page_url: location.href,
        referrer: document.referrer || null,
        submitter_name: profile.name,
        submitter_email: session.user.email,
        device_info: collectDeviceInfo(),
        attachments: attached,
      };

      try {
        await submitFeedback(payload);
        // Replace form with success state
        const formBody = overlay.querySelector('[data-fbw-form]');
        const foot = overlay.querySelector('[data-fbw-foot]');
        formBody.style.display = 'none';
        foot.style.display = 'none';
        const success = document.createElement('div');
        success.className = 'fbw-success';
        success.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>
          <h2>Got it -- thank you</h2>
          <p>Your note is in the queue, attached to your account. Anyone with admin access will see it on the Feedback tab.</p>
          <button class="fbw-btn fbw-btn-cancel" data-fbw-close style="margin-top:16px;">Close</button>
        `;
        overlay.querySelector('.fbw-modal').appendChild(success);
      } catch (err) {
        showError(errBox, err.message || String(err));
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send feedback';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

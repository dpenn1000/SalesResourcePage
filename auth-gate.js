/* CT Resource Page -- shared auth gate
 *
 * Every page on ct-resource-page.com that touches non-public data
 * includes this file via:
 *
 *   <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
 *   <script src="/auth-gate.js"></script>
 *
 * The page must provide three DOM elements -- the gate switches their
 * visibility based on auth state:
 *
 *   <div id="loginScreen"> ...login form... </div>
 *   <div id="changePasswordScreen" style="display:none"> ...form... </div>
 *   <div id="appWrap"> ...all real page content... </div>
 *
 * And define a global initApp(profile, session) function. The gate calls
 * it once, after the user is authenticated and the profile is verified.
 *
 *   profile = { kind: 'manager' | 'rep',
 *               name, is_admin, is_active, must_change_password }
 *
 * Useful globals exposed to page code after sign-in:
 *
 *   window.sb            -- Supabase client (use sb.from(...), sb.auth, etc.)
 *   window.IS_ADMIN      -- true if profile is admin
 *   window.IS_MANAGER    -- true if profile.kind === 'manager'
 *   window.IS_REP        -- true if profile.kind === 'rep'
 *   window.AUTH_PROFILE  -- the full profile object
 *   window.AUTH_SESSION  -- the Supabase session (JWT lives on .access_token)
 *
 * Activity tracking globals:
 *
 *   window.trackEvent(type, metadata?)
 *     Manually log an activity event. type must be one of:
 *     'sign_in', 'sign_out', 'page_view', 'download', 'external_link',
 *     'session_end'.
 *
 * Auto-tracking (no page code required):
 *   - sign_in fires on SIGNED_IN event with a fresh role check pass
 *   - page_view fires once on initApp
 *   - sign_out fires when window.signOut() is called
 *   - download / external_link fire via click delegation:
 *     - download: href matches \.(pdf|docx?|xlsx?|pptx?|zip|csv)$ OR has [download] attr
 *     - external_link: target=_blank or href starts with http(s) (and not download)
 */

(function () {
  'use strict';

  const SUPABASE_URL = 'https://qjcozskyopetvigjhlmh.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_tBchDunvDSIU2e5L7KIzWA_G1og1Ru2';

  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.error('[auth-gate] supabase-js not loaded. Add the unpkg <script> tag before /auth-gate.js.');
    return;
  }

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  window.sb = sb;
  window.IS_ADMIN = false;
  window.IS_MANAGER = false;
  window.IS_REP = false;
  window.AUTH_PROFILE = null;
  window.AUTH_SESSION = null;

  let appStarted = false;

  function showOnly(screenId) {
    for (const id of ['loginScreen', 'changePasswordScreen', 'appWrap']) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (id === screenId) {
        el.style.display = (id === 'appWrap' ? 'block' : 'flex');
      } else {
        el.style.display = 'none';
      }
    }
  }

  function showLoginError(msg) {
    const errEl = document.getElementById('loginError');
    if (errEl) {
      errEl.textContent = msg;
      errEl.style.display = 'block';
    }
  }

  async function loadProfile(session) {
    const { data: mgr } = await sb.from('managers')
      .select('name, is_admin, status, must_change_password')
      .eq('auth_user_id', session.user.id)
      .maybeSingle();
    if (mgr) {
      return {
        kind: 'manager',
        name: mgr.name,
        is_admin: !!mgr.is_admin,
        is_active: mgr.status === 'active',
        must_change_password: !!mgr.must_change_password
      };
    }
    const { data: rep } = await sb.from('reps')
      .select('name, status, must_change_password')
      .eq('auth_user_id', session.user.id)
      .maybeSingle();
    if (rep) {
      return {
        kind: 'rep',
        name: rep.name,
        is_admin: false,
        is_active: rep.status === 'active',
        must_change_password: !!rep.must_change_password
      };
    }
    return null;
  }

  // ── Activity tracking ─────────────────────────────────────────────────
  // Fire-and-forget. Tracking failures never block the user.

  const UA_TRUNCATED = (navigator.userAgent || '').slice(0, 500);
  const VALID_EVENTS = new Set([
    'sign_in', 'sign_out', 'page_view', 'download', 'external_link', 'session_end'
  ]);

  async function trackEvent(eventType, metadata) {
    try {
      if (!VALID_EVENTS.has(eventType)) {
        console.warn('[auth-gate] unknown event type:', eventType);
        return;
      }
      const session = window.AUTH_SESSION;
      if (!session || !session.user) return;
      const payload = {
        auth_user_id: session.user.id,
        event_type: eventType,
        page_url: window.location.pathname + window.location.search,
        metadata: metadata || {},
        user_agent: UA_TRUNCATED
      };
      // Don't await -- fire and forget. Errors logged but ignored.
      sb.from('user_activity').insert(payload).then(({ error }) => {
        if (error) console.warn('[auth-gate] trackEvent error:', error.message);
      });
    } catch (e) {
      console.warn('[auth-gate] trackEvent threw:', e);
    }
  }
  window.trackEvent = trackEvent;

  // Click delegation -- auto-track downloads and external links once a
  // user is signed in. No per-link instrumentation needed in pages.
  document.addEventListener('click', (e) => {
    if (!window.AUTH_PROFILE) return; // not signed in yet
    const a = e.target.closest && e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    const label = (a.textContent || '').trim().slice(0, 200);
    const isDownload =
      a.hasAttribute('download') ||
      /\.(pdf|docx?|xlsx?|pptx?|zip|csv|txt|jpg|jpeg|png)$/i.test(href);
    if (isDownload) {
      trackEvent('download', { url: href, label });
      return;
    }
    const isExternal =
      a.target === '_blank' ||
      /^https?:\/\//i.test(href) && !href.startsWith(window.location.origin);
    if (isExternal) {
      trackEvent('external_link', { url: href, label });
    }
  }, true);

  // Best-effort session_end on tab close -- uses sendBeacon-style approach
  // via the Supabase REST endpoint. The fetch is keepalive so it survives
  // the page unload.
  window.addEventListener('beforeunload', () => {
    const session = window.AUTH_SESSION;
    if (!session || !session.user) return;
    try {
      const body = JSON.stringify({
        auth_user_id: session.user.id,
        event_type: 'session_end',
        page_url: window.location.pathname,
        metadata: {},
        user_agent: UA_TRUNCATED
      });
      fetch(SUPABASE_URL + '/rest/v1/user_activity', {
        method: 'POST',
        keepalive: true,
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + session.access_token,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body
      });
    } catch {}
  });

  // ── Auth state machine ───────────────────────────────────────────────

  sb.auth.onAuthStateChange((event, session) => {
    if (!session) {
      showOnly('loginScreen');
      return;
    }
    // CRITICAL: defer Supabase calls out of the auth state machine -- awaiting
    // them inside this callback deadlocks the SDK (sign-in hangs forever).
    setTimeout(async () => {
      const profile = await loadProfile(session);
      if (!profile) {
        showLoginError("Your account isn't authorized for this app. Contact Dan if you need access.");
        await sb.auth.signOut();
        return;
      }
      if (!profile.is_active) {
        showLoginError("Your account has been deactivated. Contact Dan if this is in error.");
        await sb.auth.signOut();
        return;
      }
      if (profile.must_change_password) {
        showOnly('changePasswordScreen');
        return;
      }
      window.IS_ADMIN = profile.is_admin;
      window.IS_MANAGER = profile.kind === 'manager';
      window.IS_REP = profile.kind === 'rep';
      window.AUTH_PROFILE = profile;
      window.AUTH_SESSION = session;
      showOnly('appWrap');

      // Track sign_in only on the actual SIGNED_IN event, not every
      // TOKEN_REFRESHED tick. Track page_view on each fresh page load.
      if (event === 'SIGNED_IN') {
        trackEvent('sign_in', { kind: profile.kind, is_admin: profile.is_admin });
      }

      if (!appStarted) {
        appStarted = true;
        // Log the initial page view for this session/page.
        trackEvent('page_view', { kind: profile.kind, name: profile.name });
        if (typeof window.initApp === 'function') {
          window.initApp(profile, session);
        }
      }
    }, 0);
  });

  window.signIn = async function signIn() {
    const raw   = (document.getElementById('loginUser').value || '').trim().toLowerCase();
    const pass  = document.getElementById('loginPass').value;
    const errEl = document.getElementById('loginError');
    const btn   = document.getElementById('loginBtn');
    if (errEl) errEl.style.display = 'none';
    if (!raw || !pass) {
      showLoginError('Enter your username and password.');
      return;
    }
    const email = raw.includes('@') ? raw : raw + '@ct-resource-page.com';
    const oldText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in...'; }
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (btn) { btn.disabled = false; btn.textContent = oldText; }
    if (error) showLoginError(error.message);
  };

  window.signOut = async function signOut() {
    // Track BEFORE we sign out, while we still have a valid session
    await trackEvent('sign_out', {});
    // tiny delay to let the insert flush (the request was fired sync but
    // may not have hit the wire yet)
    await new Promise(r => setTimeout(r, 50));
    await sb.auth.signOut();
  };

  window.changePassword = async function changePassword() {
    const newPass = document.getElementById('cpNew').value;
    const confirmPass = document.getElementById('cpConfirm').value;
    const errEl = document.getElementById('cpError');
    const btn   = document.getElementById('cpBtn');
    if (errEl) errEl.style.display = 'none';
    if (newPass.length < 8) {
      if (errEl) { errEl.textContent = 'Password must be at least 8 characters.'; errEl.style.display = 'block'; }
      return;
    }
    if (newPass !== confirmPass) {
      if (errEl) { errEl.textContent = 'Passwords do not match.'; errEl.style.display = 'block'; }
      return;
    }
    const oldText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }
    const { error: pwErr } = await sb.auth.updateUser({ password: newPass });
    if (pwErr) {
      if (btn) { btn.disabled = false; btn.textContent = oldText; }
      if (errEl) { errEl.textContent = pwErr.message; errEl.style.display = 'block'; }
      return;
    }
    const { data: { user } } = await sb.auth.getUser();
    await sb.from('managers').update({ must_change_password: false }).eq('auth_user_id', user.id);
    await sb.from('reps').update({ must_change_password: false }).eq('auth_user_id', user.id);
    window.location.reload();
  };
})();

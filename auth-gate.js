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
    // One round trip: get_user_profile() checks managers then reps server-side
    // (SECURITY DEFINER) and returns the caller's identity row, managers first.
    // Replaces the prior two sequential client queries. The `session` arg is
    // kept for signature compatibility; the RPC reads auth.uid() from the JWT.
    const { data, error } = await sb.rpc('get_user_profile');
    if (error) {
      // The RPC itself errored -- almost always an expired/revoked token (e.g.
      // the user's session was invalidated by a password reset), which makes the
      // request fall back to `anon` (no EXECUTE on get_user_profile). This is a
      // SESSION problem, NOT an authorization one. Signal it distinctly so the
      // gate does not tell a legitimately-authorized user they are "not authorized".
      console.warn('[auth-gate] get_user_profile error:', error.message);
      return { _sessionError: true };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      kind: row.kind,
      name: row.name,
      is_admin: !!row.is_admin,
      is_active: !!row.is_active,
      must_change_password: !!row.must_change_password
    };
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
      // Reset appStarted so the next sign-in re-fires initApp. Without this,
      // a user who signs out and signs back in within the same page lifetime
      // gets stuck with an empty app (sign_in tracks, initApp does not run).
      // Incident 2026-05-15: Anthony Venditto + Charles Romanos saw a blank
      // Flips Tracker because of this gate.
      appStarted = false;
      showOnly('loginScreen');
      return;
    }
    // CRITICAL: defer Supabase calls out of the auth state machine -- awaiting
    // them inside this callback deadlocks the SDK (sign-in hangs forever).
    setTimeout(async () => {
      const profile = await loadProfile(session);
      if (profile && profile._sessionError) {
        // Token/RPC failure (expired or password-reset-revoked session). Clear the
        // dead session so the next sign-in is clean, and tell the user the truth.
        showLoginError('Your session expired. Please sign in again.');
        await sb.auth.signOut();
        return;
      }
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

      // Track sign_in ONLY for a genuine credential sign-in (flagged by
      // signIn()). SIGNED_IN also fires on session-restore on every page load,
      // which otherwise logged a sign_in per navigation and flooded
      // user_activity.
      if (event === 'SIGNED_IN' && window.__ctCredentialSignIn) {
        window.__ctCredentialSignIn = false;
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
    // Forgiving normalization for iPhone keyboards + autocorrect + autofill:
    //   - trim + lowercase
    //   - strip all whitespace anywhere in the field (auto-spacing after
    //     a name suggestion is the #1 first-timer trap)
    //   - if the rep typed a full email (anything @ anything), drop the
    //     domain and force our synthetic one. Covers "john@trinity-solar.com"
    //     autofill from corporate mail, "john@gmail.com" autofill from
    //     personal mail, and accidental "john@" trailing.
    const rawInput = (document.getElementById('loginUser').value || '');
    const rawTrim  = rawInput.trim().toLowerCase().replace(/\s+/g, '');
    const localPart = rawTrim.includes('@') ? rawTrim.split('@')[0] : rawTrim;
    const pass  = document.getElementById('loginPass').value;
    const errEl = document.getElementById('loginError');
    const btn   = document.getElementById('loginBtn');
    if (errEl) errEl.style.display = 'none';
    if (!localPart || !pass) {
      showLoginError('Enter your username and password.');
      return;
    }
    const email = localPart + '@ct-resource-page.com';
    const oldText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in...'; }
    // Flag a genuine credential sign-in so the auth-state handler logs exactly
    // one sign_in (and not the SIGNED_IN that fires on every session-restore).
    window.__ctCredentialSignIn = true;
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (btn) { btn.disabled = false; btn.textContent = oldText; }
    if (error) {
      window.__ctCredentialSignIn = false;
      // The default Supabase message ("Invalid login credentials") leaves
      // first-timers wondering whether their username or their password is
      // the problem. Hint at both, and reinforce the username format.
      const msg = /invalid login credentials/i.test(error.message || '')
        ? 'That username and password did not match. Your username is your last name with first initial (no spaces, no email). Starter password is Trinity1.'
        : error.message;
      showLoginError(msg);
    }
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
    // Clear must_change_password via the SECURITY DEFINER RPC. Direct UPDATE
    // on managers fails RLS for non-admin managers (mgr_write_admin requires
    // is_admin()), which used to trap non-admin managers in the change-pw
    // loop (incident 2026-05-14, Anthony Venditto). The RPC is scoped to
    // ONLY clearing the flag on the caller's own row in either table, so
    // there's no privilege-escalation surface.
    const { error: clearErr } = await sb.rpc('clear_must_change_password');
    if (clearErr) console.warn('[auth-gate] clear_must_change_password failed:', clearErr.message);
    window.location.reload();
  };
})();

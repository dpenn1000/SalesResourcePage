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
 *   <div id="loginScreen"> ...login form, see auth-gate.css recipe... </div>
 *   <div id="changePasswordScreen" style="display:none"> ...change-pw form... </div>
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
 * Buttons in the page can call window.signOut() to log out.
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
    // Check managers table first; reps fall through.
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

  sb.auth.onAuthStateChange((_e, session) => {
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
      if (!appStarted) {
        appStarted = true;
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
    // The flag lives on whichever table the user belongs to. Clearing both is
    // safe -- the one they don't belong to no-ops via the eq filter.
    await sb.from('managers').update({ must_change_password: false }).eq('auth_user_id', user.id);
    await sb.from('reps').update({ must_change_password: false }).eq('auth_user_id', user.id);
    // Hard reload to avoid the race between USER_UPDATED firing and the
    // flag-clear completing. On reload the auth listener sees the cleared
    // flag and lands the user in the app cleanly.
    window.location.reload();
  };
})();

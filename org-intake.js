/* CT Resource Page -- shared org-chart change intake + review UI
 *
 *   <script src="/org-intake.js"></script>   (after /org-data.js)
 *
 * Drops a "Suggest a change" button on the page that any signed-in user can
 * use to recommend a person/role/contact change or addition. Submissions land
 * in org_change_requests (pending) for an admin to review. Admins also get a
 * "Review changes" queue that approves/denies via the gated apply RPC -- the
 * single write path into the canonical org tables.
 *
 * Self-contained: injects its own styles, works on top of either manager page.
 * Requires window.OrgData (and window.sb / window.IS_ADMIN from auth-gate).
 *
 *   OrgIntake.mount(orgData)   // orgData = result of OrgData.load()
 */
(function () {
  'use strict';

  var STYLE = ''
    + '.oi-fab{position:fixed;left:16px;bottom:72px;z-index:1000;display:flex;gap:8px}'  /* sits above the site-back pill (bottom:16) */
    + '.oi-fab button{font:600 13px/1 Manrope,system-ui,sans-serif;border:0;border-radius:999px;'
    + 'padding:11px 16px;cursor:pointer;box-shadow:0 6px 18px rgba(16,32,56,.22)}'
    + '.oi-fab .oi-suggest{background:#5FA520;color:#fff}'
    + '.oi-fab .oi-review{background:#1A2332;color:#fff}'
    + '.oi-fab .oi-review b{background:#DC9B3C;color:#0b1120;border-radius:999px;padding:1px 7px;margin-left:6px}'
    + '.oi-scrim{position:fixed;inset:0;background:rgba(8,14,28,.5);z-index:2147483600;display:none}'
    + '.oi-scrim.open{display:block}'
    + '.oi-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);'
    + 'width:min(560px,94vw);max-height:90vh;overflow:auto;background:#fff;border-radius:16px;'
    + 'box-shadow:0 24px 60px rgba(8,14,28,.4);font-family:Manrope,system-ui,sans-serif;display:none;z-index:2147483601}'
    + '.oi-modal.open{display:block}'
    + '.oi-h{background:linear-gradient(120deg,#0F2038,#1A2942);color:#fff;padding:16px 20px;border-radius:16px 16px 0 0;'
    + 'display:flex;justify-content:space-between;align-items:center}'
    + '.oi-h h3{margin:0;font:700 16px/1.2 Fraunces,Georgia,serif}'
    + '.oi-h .oi-x{background:rgba(255,255,255,.14);border:0;color:#fff;width:30px;height:30px;border-radius:8px;font-size:18px;cursor:pointer}'
    + '.oi-b{padding:18px 20px}'
    + '.oi-b label{display:block;font:700 11px/1 Manrope;letter-spacing:.08em;text-transform:uppercase;color:#6b7a90;margin:14px 0 5px}'
    + '.oi-b input,.oi-b select,.oi-b textarea{width:100%;font:400 14px Manrope;padding:9px 11px;border:1px solid #d4dae3;border-radius:9px;background:#fff;color:#28303e}'
    + '.oi-b textarea{min-height:60px;resize:vertical}'
    + '.oi-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
    + '.oi-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}'
    + '.oi-actions button{font:700 13px Manrope;border:0;border-radius:9px;padding:10px 16px;cursor:pointer}'
    + '.oi-actions .oi-primary{background:#5FA520;color:#fff}.oi-actions .oi-ghost{background:#eef1f5;color:#28303e}'
    + '.oi-note{font-size:12px;color:#6b7a90;margin-top:6px;line-height:1.5}'
    + '.oi-msg{margin-top:12px;padding:10px 12px;border-radius:9px;font-size:13px;display:none}'
    + '.oi-msg.ok{display:block;background:#EDFAD6;color:#3c7a0e}.oi-msg.err{display:block;background:#fde8e8;color:#b42318}'
    + '.oi-card{border:1px solid #e6eaf0;border-radius:11px;padding:12px 14px;margin-bottom:11px}'
    + '.oi-card .oi-ct{font:700 13px Manrope;color:#0F2038}.oi-card .oi-cs{font-size:12px;color:#6b7a90;margin-top:3px}'
    + '.oi-card pre{background:#f6f8fb;border-radius:7px;padding:8px;margin:8px 0;font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word}'
    + '.oi-card .oi-cb{display:flex;gap:8px;margin-top:8px}'
    + '.oi-card .oi-approve{background:#5FA520;color:#fff}.oi-card .oi-deny{background:#fde8e8;color:#b42318}'
    + '.oi-card button{font:700 12px Manrope;border:0;border-radius:8px;padding:7px 13px;cursor:pointer}';

  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  var data, scrim, modal;

  function openModal(html) { modal.querySelector('.oi-b').innerHTML = html; scrim.classList.add('open'); modal.classList.add('open'); }
  function closeModal() { scrim.classList.remove('open'); modal.classList.remove('open'); }

  function personOptions(selected) {
    return Object.keys(data.N)
      .filter(function (k) { var n = data.N[k]; return !n.group && !n.info; })
      .sort(function (a, b) { return (data.N[a].n || '').localeCompare(data.N[b].n || ''); })
      .map(function (k) { return '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + esc(data.N[k].n) + (data.N[k].t ? ' -- ' + esc(data.N[k].t) : '') + '</option>'; })
      .join('');
  }
  function deptOptions() {
    return (data.departments || []).map(function (d) { return '<option value="' + d.slug + '">' + esc(d.name) + '</option>'; }).join('');
  }

  // ---------- Suggest form ----------
  function suggestForm() {
    openModal(''
      + '<label>What would you like to change?</label>'
      + '<select id="oiKind">'
      + '  <option value="edit_person">Update a person (title, office)</option>'
      + '  <option value="add_person">Add a person</option>'
      + '  <option value="reassign">Change who someone reports to</option>'
      + '  <option value="contact">Add or change a contact method</option>'
      + '  <option value="member">Add someone to a department</option>'
      + '</select>'
      + '<div id="oiFields"></div>'
      + '<label>Anything else we should know? (optional)</label>'
      + '<textarea id="oiNote" placeholder="Why this change, or any detail a reviewer needs"></textarea>'
      + '<div class="oi-msg" id="oiMsg"></div>'
      + '<div class="oi-actions"><button class="oi-ghost" id="oiCancel">Cancel</button>'
      + '<button class="oi-primary" id="oiSubmit">Submit for review</button></div>');
    var kind = modal.querySelector('#oiKind');
    function renderFields() {
      var f = modal.querySelector('#oiFields'), v = kind.value, h = '';
      if (v === 'edit_person') {
        h = '<label>Person</label><select id="oiPerson">' + personOptions() + '</select>'
          + '<label>New title</label><input id="oiTitle" placeholder="leave blank to keep current">'
          + '<label>New office</label><input id="oiOffice" placeholder="leave blank to keep current">';
      } else if (v === 'add_person') {
        h = '<div class="oi-row"><div><label>Name</label><input id="oiName"></div>'
          + '<div><label>Title</label><input id="oiTitle"></div></div>'
          + '<div class="oi-row"><div><label>Office</label><input id="oiOffice"></div>'
          + '<div><label>Reports to</label><select id="oiParent"><option value="">(none)</option>' + personOptions() + '</select></div></div>';
      } else if (v === 'reassign') {
        h = '<label>Person</label><select id="oiPerson">' + personOptions() + '</select>'
          + '<label>New manager</label><select id="oiParent"><option value="">(none / top)</option>' + personOptions() + '</select>';
      } else if (v === 'contact') {
        h = '<label>Whose contact?</label><select id="oiOwnerType"><option value="person">A person</option><option value="department">A department</option></select>'
          + '<div id="oiOwnerWrap"><label>Person</label><select id="oiOwner">' + personOptions() + '</select></div>'
          + '<div class="oi-row"><div><label>Method</label><select id="oiMethod">'
          + ['email','phone','salesforce','channel','inbox','teams','hours','other'].map(function(m){return '<option>'+m+'</option>';}).join('')
          + '</select></div><div><label>Label (shown)</label><input id="oiLabel" placeholder="e.g. Email"></div></div>'
          + '<label>Value</label><input id="oiValue" placeholder="e.g. Sales.Ops@Trinity-Solar.com">'
          + '<label style="display:flex;align-items:center;gap:8px;text-transform:none;font-size:13px;letter-spacing:0;color:#28303e">'
          + '<input type="checkbox" id="oiPref" style="width:auto"> Mark as the preferred way to reach them</label>';
      } else if (v === 'member') {
        h = '<label>Department</label><select id="oiDept">' + deptOptions() + '</select>'
          + '<label>Person</label><select id="oiPerson">' + personOptions() + '</select>'
          + '<label>Role on that team</label><input id="oiRole" placeholder="e.g. Manager, Team Lead">';
      }
      f.innerHTML = h;
      var ot = modal.querySelector('#oiOwnerType');
      if (ot) ot.onchange = function () {
        modal.querySelector('#oiOwnerWrap').innerHTML = ot.value === 'person'
          ? '<label>Person</label><select id="oiOwner">' + personOptions() + '</select>'
          : '<label>Department</label><select id="oiOwner">' + deptOptions() + '</select>';
      };
    }
    kind.onchange = renderFields; renderFields();
    modal.querySelector('#oiCancel').onclick = closeModal;
    modal.querySelector('#oiSubmit').onclick = submitSuggestion;
  }

  function val(id) { var e = modal.querySelector('#' + id); return e ? (e.type === 'checkbox' ? e.checked : e.value.trim()) : ''; }
  function slugFor(name) {
    var base = (name || '').toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/);
    var key = (base[0] || 'person') + (base[1] ? base[1][0] : '');
    var k = key, i = 2; while (data.N[k]) { k = key + i; i++; } return k;
  }

  async function submitSuggestion() {
    var kind = val('oiKind'), note = val('oiNote'), payload = null;
    try {
      if (kind === 'edit_person') {
        var pp = {}; if (val('oiTitle')) pp.title = val('oiTitle'); if (val('oiOffice')) pp.office = val('oiOffice');
        if (!Object.keys(pp).length) return showMsg('Enter a new title or office.', false);
        payload = { target_type: 'person', action: 'edit', target_id: val('oiPerson'), proposed_payload: pp };
      } else if (kind === 'add_person') {
        if (!val('oiName')) return showMsg('Enter a name.', false);
        payload = { target_type: 'person', action: 'add', proposed_payload: {
          key: slugFor(val('oiName')), name: val('oiName'), title: val('oiTitle'), office: val('oiOffice'), parent_key: val('oiParent') } };
      } else if (kind === 'reassign') {
        payload = { target_type: 'person', action: 'reassign_parent', target_id: val('oiPerson'), proposed_payload: { new_parent_key: val('oiParent') } };
      } else if (kind === 'contact') {
        if (!val('oiValue')) return showMsg('Enter the contact value.', false);
        payload = { target_type: 'contact_method', action: 'add', proposed_payload: {
          owner_type: val('oiOwnerType'), owner_key: val('oiOwner'), method: val('oiMethod'),
          label: val('oiLabel') || val('oiMethod'), value: val('oiValue'), preferred: val('oiPref') } };
      } else if (kind === 'member') {
        payload = { target_type: 'department_member', action: 'add', proposed_payload: {
          dept_slug: val('oiDept'), person_key: val('oiPerson'), role_in_dept: val('oiRole') } };
      }
      payload.submitter_note = note;
      var res = await window.OrgData.submitChange(payload);
      if (res.error) return showMsg('Could not submit: ' + res.error.message, false);
      showMsg('Thanks -- your suggestion was sent for review.', true);
      setTimeout(closeModal, 1400);
    } catch (e) { showMsg('Something went wrong: ' + e.message, false); }
  }

  function showMsg(text, ok) {
    var m = modal.querySelector('#oiMsg'); if (!m) return;
    m.textContent = text; m.className = 'oi-msg ' + (ok ? 'ok' : 'err');
  }

  // ---------- Admin review queue ----------
  async function reviewQueue() {
    openModal('<p style="color:#6b7a90">Loading…</p>');
    var res = await window.OrgData.listPending();
    if (res.error) return openModal('<div class="oi-msg err">' + esc(res.error.message) + '</div>');
    var rows = res.data || [];
    if (!rows.length) { openModal('<p style="color:#6b7a90;margin:8px 0">No pending suggestions. 🎉</p>'
      + '<div class="oi-actions"><button class="oi-ghost" id="oiCancel">Close</button></div>');
      modal.querySelector('#oiCancel').onclick = closeModal; return; }
    var html = rows.map(function (r) {
      return '<div class="oi-card" data-id="' + r.id + '">'
        + '<div class="oi-ct">' + esc(r.action) + ' &middot; ' + esc(r.target_type) + (r.target_id ? ' &middot; ' + esc(r.target_id) : '') + '</div>'
        + (r.submitter_note ? '<div class="oi-cs">“' + esc(r.submitter_note) + '”</div>' : '')
        + '<pre>' + esc(JSON.stringify(r.proposed_payload, null, 2)) + '</pre>'
        + '<div class="oi-cb"><button class="oi-approve">Approve &amp; apply</button><button class="oi-deny">Deny</button></div>'
        + '<div class="oi-msg" data-msg></div></div>';
    }).join('');
    openModal(html + '<div class="oi-actions"><button class="oi-ghost" id="oiCancel">Close</button></div>');
    modal.querySelector('#oiCancel').onclick = closeModal;
    modal.querySelectorAll('.oi-card').forEach(function (card) {
      var id = card.getAttribute('data-id'), msg = card.querySelector('[data-msg]');
      card.querySelector('.oi-approve').onclick = function () { decide(id, 'approve', msg, card); };
      card.querySelector('.oi-deny').onclick = function () { decide(id, 'deny', msg, card); };
    });
  }

  async function decide(id, decision, msg, card) {
    msg.className = 'oi-msg'; msg.textContent = '';
    var res = await window.OrgData.applyChange(id, decision, null);
    if (res.error) { msg.className = 'oi-msg err'; msg.textContent = res.error.message; return; }
    card.style.opacity = '.5';
    card.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    msg.className = 'oi-msg ok';
    msg.textContent = decision === 'approve' ? 'Applied. Reload the page to see it.' : 'Denied.';
  }

  // ---------- mount ----------
  var OrgIntake = {
    mount: function (orgData) {
      data = orgData;
      if (document.getElementById('oiStyle')) return; // mount once
      var st = document.createElement('style'); st.id = 'oiStyle'; st.textContent = STYLE; document.head.appendChild(st);
      scrim = el('<div class="oi-scrim"></div>');
      modal = el('<div class="oi-modal"><div class="oi-h"><h3>Suggest a change</h3><button class="oi-x">&times;</button></div><div class="oi-b"></div></div>');
      document.body.appendChild(scrim); document.body.appendChild(modal);
      scrim.onclick = closeModal; modal.querySelector('.oi-x').onclick = closeModal;

      var fab = el('<div class="oi-fab"></div>');
      var sBtn = el('<button class="oi-suggest">&#9998; Suggest a change</button>');
      sBtn.onclick = function () { modal.querySelector('.oi-h h3').textContent = 'Suggest a change'; suggestForm(); };
      fab.appendChild(sBtn);
      if (window.IS_ADMIN) {
        var rBtn = el('<button class="oi-review">Review changes</button>');
        rBtn.onclick = function () { modal.querySelector('.oi-h h3').textContent = 'Pending suggestions'; reviewQueue(); };
        fab.appendChild(rBtn);
        // badge with pending count (best-effort)
        window.OrgData.listPending().then(function (res) {
          var n = res && res.data ? res.data.length : 0;
          if (n) rBtn.innerHTML = 'Review changes <b>' + n + '</b>';
        });
      }
      document.body.appendChild(fab);
    }
  };
  window.OrgIntake = OrgIntake;
})();

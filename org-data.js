/* Current -- shared org-chart data layer
 *
 *   <script src="/org-data.js"></script>   (after /auth-gate.js)
 *
 * One source of truth for the company org chart. Both manager pages
 * (/management/org-chart and /management/departments-communications) load
 * their people, departments, and contact methods from here instead of
 * hand-keyed inline copies -- so an edit in one place shows up everywhere
 * and the two pages can never drift.
 *
 * Backed by Supabase tables org_chart / org_departments /
 * org_department_members / org_contact_methods (managers-only RLS). Writes go
 * exclusively through the change-request intake (submitChange) + the
 * admin-only apply RPC (applyChange) -- there is no client-side direct write.
 *
 * Requires window.sb (from /auth-gate.js). Exposes window.OrgData.
 */
(function () {
  'use strict';

  function initials(name) {
    var w = (name || '').replace(/[^A-Za-z &·/]/g, '').split(/[\s·/&]+/).filter(Boolean);
    return ((w[0] && w[0][0] || '') + (w[1] && w[1][0] || '')).toUpperCase();
  }

  var OrgData = {
    initials: initials,
    _cache: null,

    /* Load the whole org graph in one shot (4 small reads, RLS-gated to managers).
     * Returns shapes the existing renderers already consume:
     *   N            -- File A object: { key: {p,n,t,o,span,d,dotted,flag,group,info,c{...,reach[]}} }
     *   departments  -- File B array:  [ {slug,name,subtitle,icon,accent,salesforce_handle,members[],reach[]} ]
     *   peopleByKey  -- raw org_chart rows keyed by key (for intake pickers)
     */
    load: async function () {
      var sb = window.sb;
      if (!sb) throw new Error('org-data: window.sb not ready (load /auth-gate.js first)');
      var res = await Promise.all([
        sb.from('org_chart').select('*').order('sort_order', { ascending: true }),
        sb.from('org_contact_methods').select('*').order('sort_order', { ascending: true }),
        sb.from('org_departments').select('*').order('sort_order', { ascending: true }),
        sb.from('org_department_members').select('*').order('sort_order', { ascending: true })
      ]);
      for (var i = 0; i < res.length; i++) if (res[i].error) throw res[i].error;
      var people = res[0].data, methods = res[1].data, depts = res[2].data, members = res[3].data;

      // --- File A: rebuild the N object ---
      var N = {}, peopleByKey = {};
      people.forEach(function (r) {
        peopleByKey[r.key] = r;
        var node = { p: r.parent_key, n: r.name, t: r.title, o: r.office, span: r.span, d: r.dept };
        if (r.dotted) node.dotted = 1;
        if (r.flag) node.flag = r.flag;
        if (r.node_type === 'group') node.group = 1;
        if (r.node_type === 'info') node.info = 1;
        if (r.contact && typeof r.contact === 'object') node.c = Object.assign({}, r.contact);
        N[r.key] = node;
      });
      // person reach -> c.reach (rebuilt here so reach lives in exactly one table)
      methods.filter(function (m) { return m.owner_type === 'person'; })
        .forEach(function (m) {
          var node = N[m.owner_key]; if (!node) return;
          node.c = node.c || {};
          (node.c.reach = node.c.reach || []).push({ k: m.label, v: m.value });
        });

      // --- File B: departments with members + reach ---
      var deptBySlug = {};
      var departments = depts.map(function (d) {
        var obj = {
          slug: d.slug, kind: d.kind, name: d.name, subtitle: d.subtitle, icon: d.icon,
          accent: d.accent, salesforce_handle: d.salesforce_handle,
          narrative_does: d.narrative_does, narrative_when: d.narrative_when,
          members: [], reach: []
        };
        deptBySlug[d.slug] = obj;
        return obj;
      });
      members.forEach(function (m) {
        var d = deptBySlug[m.dept_slug]; if (!d) return;
        var person = N[m.person_key];
        d.members.push({ key: m.person_key, name: person ? person.n : m.person_key, role: m.role_in_dept });
      });
      methods.filter(function (m) { return m.owner_type === 'department'; })
        .forEach(function (m) {
          var d = deptBySlug[m.owner_key]; if (!d) return;
          d.reach.push({ label: m.label, value: m.value, preferred: m.preferred });
        });

      this._cache = { N: N, departments: departments, deptBySlug: deptBySlug, peopleByKey: peopleByKey };
      return this._cache;
    },

    /* HTML for a File B .people block from a department's members. */
    peopleHTML: function (members) {
      return (members || []).map(function (p) {
        return '<div class="person"><div class="pav">' + initials(p.name) + '</div>'
          + '<div><div class="pn">' + esc(p.name) + '</div>'
          + '<div class="pr">' + esc(p.role || '') + '</div></div></div>';
      }).join('');
    },

    /* HTML for a File B .reach block from a department's contact methods. */
    reachHTML: function (reach) {
      return (reach || []).map(function (r) {
        return '<div class="reach-line"><b>' + esc(r.label) + ':</b> ' + esc(r.value)
          + (r.preferred ? ' <em>(preferred)</em>' : '') + '</div>';
      }).join('');
    },

    /* Fill any <... data-org-people="slug"> / data-org-reach="slug"> placeholders
     * on the page from loaded data. Leaves a block untouched if the slug has no
     * data (graceful: authored HTML stays as a fallback). */
    injectPlaceholders: function (data) {
      var self = this;
      document.querySelectorAll('[data-org-people]').forEach(function (el) {
        var d = data.deptBySlug[el.getAttribute('data-org-people')];
        if (d && d.members.length) el.innerHTML = self.peopleHTML(d.members);
      });
      document.querySelectorAll('[data-org-reach]').forEach(function (el) {
        var d = data.deptBySlug[el.getAttribute('data-org-reach')];
        if (d && d.reach.length) el.innerHTML = self.reachHTML(d.reach);
      });
    },

    // ---- intake: any authenticated user may submit a change request ----
    submitChange: async function (payload) {
      var sb = window.sb;
      var row = {
        target_type: payload.target_type,
        action: payload.action,
        target_id: payload.target_id || null,
        proposed_payload: payload.proposed_payload || {},
        submitter_note: payload.submitter_note || null
      };
      return sb.from('org_change_requests').insert(row).select().single();
    },

    // ---- review: admin-only, list + apply via the gated RPC ----
    listPending: async function () {
      return window.sb.from('org_change_requests').select('*')
        .eq('status', 'pending').order('created_at', { ascending: true });
    },
    applyChange: async function (id, decision, note) {
      return window.sb.rpc('org_apply_change_request', {
        p_request_id: id, p_decision: decision, p_note: note || null
      });
    }
  };

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  window.OrgData = OrgData;
})();

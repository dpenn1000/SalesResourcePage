/* Current -- canonical state / office / division config.
 *
 *   <script src="/org-config.js"></script>   (before the page's own script)
 *
 * GENERATED FILE -- DO NOT EDIT BY HAND.
 * Sources: Apps/markets.json (states/offices) + Apps/org.json (departments,
 * positions), via Apps/scripts/sync_org_config.py. To change an office, add a
 * state, or add a department or position, edit the source and re-run:
 *     python scripts/sync_org_config.py --sync
 *
 * `offices` are the exact strings stored on people.sales_office. They must stay
 * exact: get_my_reps() scopes an ADM by string equality on that column, so a
 * near-miss ("CT-North") silently empties their roster instead of erroring.
 *
 * A `position` derives role + tier + the is_national default, so an admin picks
 * one meaningful thing instead of four controls that can contradict each other.
 *
 * Exposes window.ORG_CONFIG.
 */
window.ORG_CONFIG = {
  "default_state": "CT",
  "states": {
    "CT": {
      "label": "Connecticut",
      "offices": [
        "CT- North",
        "CT- Central"
      ],
      "divisions": [
        "Traditional",
        "Direct"
      ]
    },
    "MA": {
      "label": "Massachusetts",
      "offices": [
        "MA- West"
      ],
      "divisions": [
        "Traditional",
        "Direct"
      ]
    },
    "NJ": {
      "label": "New Jersey",
      "offices": [
        "NJ- North",
        "NJ- South",
        "NJ- East",
        "NJ- West",
        "NJ- Northeast",
        "NJ- Northwest"
      ],
      "divisions": [
        "Traditional",
        "Direct"
      ]
    },
    "NY": {
      "label": "New York",
      "offices": [
        "NY- South",
        "NY- Long Island - Nassau",
        "NY- Long Island - Suffolk"
      ],
      "divisions": [
        "Traditional",
        "Direct"
      ]
    },
    "PA": {
      "label": "Pennsylvania",
      "offices": [
        "PA- South",
        "PA- North",
        "PA- E Lancaster"
      ],
      "divisions": [
        "Traditional",
        "Direct"
      ]
    }
  },
  "departments": [
    {
      "key": "sales",
      "label": "Sales",
      "is_sales": true
    },
    {
      "key": "sales_ops",
      "label": "Sales Operations"
    },
    {
      "key": "cc",
      "label": "Call Center"
    },
    {
      "key": "installation",
      "label": "Installation"
    },
    {
      "key": "finance",
      "label": "Finance"
    },
    {
      "key": "marketing",
      "label": "Marketing"
    },
    {
      "key": "it",
      "label": "IT / Data"
    },
    {
      "key": "legal",
      "label": "Legal"
    },
    {
      "key": "hr",
      "label": "Human Resources"
    }
  ],
  "positions": [
    {
      "key": "rep",
      "label": "Sales Representative",
      "departments": [
        "sales"
      ],
      "role": "rep",
      "tier": null,
      "is_national": false,
      "needs_rep_key": true,
      "needs_office": true,
      "seeds_onboarding": true,
      "allow_admin": false,
      "sees": "Their own numbers only."
    },
    {
      "key": "adm",
      "label": "ADM -- Assistant District Manager",
      "departments": [
        "sales"
      ],
      "role": "manager",
      "tier": "adm",
      "is_national": false,
      "needs_rep_key": true,
      "needs_office": true,
      "seeds_onboarding": false,
      "allow_admin": true,
      "sees": "Reps in their own sales office, and nobody above them. The office must match exactly or they see nobody."
    },
    {
      "key": "dm",
      "label": "DM -- District Manager",
      "departments": [
        "sales"
      ],
      "role": "manager",
      "tier": "dm",
      "is_national": false,
      "needs_rep_key": true,
      "needs_office": true,
      "seeds_onboarding": false,
      "allow_admin": true,
      "sees": "Everyone in their state(s), at DM level and below."
    },
    {
      "key": "regional",
      "label": "Regional Manager",
      "departments": [
        "sales"
      ],
      "role": "manager",
      "tier": "regional",
      "is_national": false,
      "needs_rep_key": true,
      "needs_office": false,
      "seeds_onboarding": false,
      "allow_admin": true,
      "sees": "Everyone in their state(s), at regional level and below."
    },
    {
      "key": "vp",
      "label": "VP of Sales",
      "departments": [
        "sales"
      ],
      "role": "manager",
      "tier": "vp",
      "is_national": true,
      "needs_rep_key": false,
      "needs_office": false,
      "seeds_onboarding": false,
      "allow_admin": true,
      "sees": "Everyone, in every state."
    },
    {
      "key": "exec",
      "label": "Executive",
      "departments": [
        "sales"
      ],
      "role": "manager",
      "tier": "executive",
      "is_national": true,
      "needs_rep_key": false,
      "needs_office": false,
      "seeds_onboarding": false,
      "allow_admin": true,
      "sees": "Everyone, in every state, plus the APEX executive surfaces."
    },
    {
      "key": "staff",
      "label": "Team member",
      "departments": [
        "sales_ops",
        "cc",
        "installation",
        "finance",
        "marketing",
        "it",
        "legal",
        "hr"
      ],
      "role": "rep",
      "tier": null,
      "is_national": false,
      "needs_rep_key": false,
      "needs_office": false,
      "seeds_onboarding": false,
      "allow_admin": false,
      "sees": "Rep-facing pages only -- University, the resource page, Updates. Never appears in a sales roster."
    },
    {
      "key": "lead",
      "label": "Team lead",
      "departments": [
        "sales_ops",
        "cc",
        "installation",
        "finance",
        "marketing",
        "it",
        "legal",
        "hr"
      ],
      "role": "manager",
      "tier": null,
      "is_national": false,
      "needs_rep_key": false,
      "needs_office": false,
      "seeds_onboarding": false,
      "allow_admin": true,
      "sees": "Manager tools, but no rep roster -- they are not on the sales ladder."
    },
    {
      "key": "dept_head",
      "label": "Department head",
      "departments": [
        "sales_ops",
        "cc",
        "installation",
        "finance",
        "marketing",
        "it",
        "legal",
        "hr"
      ],
      "role": "manager",
      "tier": "vp",
      "is_national": true,
      "needs_rep_key": false,
      "needs_office": false,
      "seeds_onboarding": false,
      "allow_admin": true,
      "sees": "Manager tools and every rep in every state -- the same visibility a sales VP has. This is how the Call Center leads are already set up."
    }
  ]
};

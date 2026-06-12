/* Shared lead geography -- one source of truth for two pages so they can't drift:
   - leadState(): which state a lead is in. COUNTY-AUTHORITATIVE: CT records often
     ship a polluted state field (junk "NJ"/"NY") while the county + town are
     correctly CT, so a recognized CT county wins over the state value.
   - CT county centroids for straight-line proximity dispatch.
   Loaded by leads.html (Quick Dispatch) and my-calls.html (call list).
   Attached to window (not top-level const) so either page can also keep a local
   alias without a redeclaration clash. */
(function () {
  // Uppercased CT county names, for state classification.
  window.CT_COUNTIES = new Set(['FAIRFIELD','HARTFORD','LITCHFIELD','MIDDLESEX','NEW HAVEN','NEW LONDON','TOLLAND','WINDHAM']);
  // Full state name -> 2-letter code, for normalizing the state field.
  window.STATE_NAME2CODE = { CONNECTICUT:'CT','NEW JERSEY':'NJ','NEW YORK':'NY',PENNSYLVANIA:'PA',MASSACHUSETTS:'MA','RHODE ISLAND':'RI' };
  // CT county centroids (lat,lng) for proximity dispatch (county-level resolution).
  window.CT_COUNTY_LL = {
    'Fairfield':[41.23,-73.37],'Hartford':[41.81,-72.73],'Litchfield':[41.79,-73.24],
    'Middlesex':[41.43,-72.53],'New Haven':[41.35,-72.90],'New London':[41.47,-72.10],
    'Tolland':[41.86,-72.34],'Windham':[41.83,-71.99]
  };
  // Best-effort 2-letter state for a lead, from its property { state, county }.
  // CT county is checked FIRST (authoritative); only when it isn't a known CT
  // county do we fall back to the normalized state field. Returns null when
  // neither is usable (those are the location-stripped ghosts that should drop).
  // NOTE: expansion to states whose county names collide with CT's (e.g. a NJ
  // "Middlesex") will need a per-state county map -- today CT is the only territory.
  window.leadState = function (prop) {
    if (!prop) return null;
    var co = ((prop.county || '') + '').trim().toUpperCase();
    if (window.CT_COUNTIES.has(co)) return 'CT';
    var s = ((prop.state || '') + '').trim().toUpperCase();
    if (s) { if (s.length === 2) return s; if (window.STATE_NAME2CODE[s]) return window.STATE_NAME2CODE[s]; }
    return null;
  };
})();

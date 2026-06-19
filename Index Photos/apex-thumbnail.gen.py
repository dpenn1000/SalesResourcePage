#!/usr/bin/env python3
"""Generate apex-thumbnail.svg -- the APEX index card.

Mirrors the live /apex hero: the green->blue APEX wordmark + the silver-shimmer
motto "BUILT TO WIN / TUNED TO LAST". The old close-rate dial is replaced by a
granular usage matrix (a denser cousin of the Dev Console heatmap) that sits
solid on the left and degranulates -- fading and thinning -- as it approaches
the hero logo on the right. Palette is lifted from the APEX page :root spec.

Re-run after any tweak:  python "Index Photos/apex-thumbnail.gen.py"
"""
import math, random, os

W, H = 1200, 675

# --- APEX page palette (:root in build_apex.py) ---
BG0, BG1 = "#0a0e1a", "#0f1424"
GREEN  = "#c5f135"   # lime
GREEN2 = "#78c832"   # Trinity green
BLUE   = "#29a9e1"   # Total Home blue
AMBER  = "#ffb648"
SILVER = "#7c828c"

# --- usage matrix geometry ---
X0, X1 = 64, 812        # matrix spans the left; dissolves toward the hero
Y0, Y1 = 70, 606
PITCH  = 15             # finer than the Dev Console heatmap (more granular)
CELL   = 12
RX     = 2

# clustering hotspots in normalized (fx, fy) so it reads like real usage data
HOTS = [(0.10, 0.30, 0.16), (0.26, 0.68, 0.18), (0.05, 0.85, 0.13)]

random.seed(7)

def clamp(v, lo=0.0, hi=1.0):
    return lo if v < lo else hi if v > hi else v

cells = []
cols = int((X1 - X0) // PITCH)
rows = int((Y1 - Y0) // PITCH)
for c in range(cols + 1):
    cx = X0 + c * PITCH
    fx = (cx - X0) / (X1 - X0)
    keep_prob = clamp(1.10 - fx) ** 1.45          # solid left -> sparse right
    leftfade  = clamp(1.08 - fx) ** 0.85          # also dims left -> right
    for r in range(rows + 1):
        cy = Y0 + r * PITCH
        fy = (cy - Y0) / (Y1 - Y0)
        if random.random() > keep_prob:
            continue
        hot = 0.0
        for hx, hy, sg in HOTS:
            d2 = (fx - hx) ** 2 + (fy - hy) ** 2
            hot = max(hot, math.exp(-d2 / (2 * sg * sg)))
        inten = clamp(0.12 + 0.55 * random.random() + 0.55 * hot)
        op = clamp((0.14 + 0.82 * inten) * leftfade, 0.0, 0.95)
        if op < 0.05:
            continue
        if random.random() < 0.06:
            col = AMBER                            # occasional accent pop
        elif inten < 0.34:
            col = BLUE
        elif inten < 0.72:
            col = GREEN2
        else:
            col = GREEN
        cells.append(f'<rect x="{cx}" y="{cy}" width="{CELL}" height="{CELL}" '
                     f'rx="{RX}" fill="{col}" opacity="{op:.3f}"/>')

XR = 1124  # hero text right edge (inside the 72px safe margin)

svg = f'''<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" font-family="'Plus Jakarta Sans',Helvetica,Arial,sans-serif">
  <defs>
    <linearGradient id="apexbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{BG0}"/>
      <stop offset="1" stop-color="{BG1}"/>
    </linearGradient>
    <radialGradient id="glowBlue" cx="0.72" cy="0" r="0.62">
      <stop offset="0" stop-color="{BLUE}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="{BLUE}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowGreen" cx="0.10" cy="1" r="0.60">
      <stop offset="0" stop-color="{GREEN}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="{GREEN}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="heroDark" cx="0.82" cy="0.55" r="0.55">
      <stop offset="0" stop-color="{BG0}" stop-opacity="0.94"/>
      <stop offset="0.55" stop-color="{BG0}" stop-opacity="0.66"/>
      <stop offset="1" stop-color="{BG0}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="apexLogo" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="{GREEN}"/>
      <stop offset="1" stop-color="{BLUE}"/>
    </linearGradient>
    <linearGradient id="apexSilver" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="{SILVER}"/>
      <stop offset="0.38" stop-color="{SILVER}"/>
      <stop offset="0.50" stop-color="#ffffff"/>
      <stop offset="0.62" stop-color="{SILVER}"/>
      <stop offset="1" stop-color="{SILVER}"/>
    </linearGradient>
  </defs>

  <rect width="{W}" height="{H}" fill="url(#apexbg)"/>
  <rect width="{W}" height="{H}" fill="url(#glowBlue)"/>
  <rect width="{W}" height="{H}" fill="url(#glowGreen)"/>

  <!-- usage matrix: solid on the left, degranulating toward the hero logo -->
  <g>
    {chr(10).join("    " + c for c in cells)}
  </g>

  <!-- darken behind the hero so the wordmark reads over the dissolving cells -->
  <rect width="{W}" height="{H}" fill="url(#heroDark)"/>

  <!-- hero: green->blue APEX wordmark + silver-shimmer motto (mirrors /apex) -->
  <text x="{XR}" y="250" text-anchor="end" fill="{GREEN}" font-size="24" font-weight="800" letter-spacing="5">MULTI-STATE ANALYSIS ENGINE</text>
  <rect x="{XR-150}" y="266" width="150" height="4" rx="2" fill="url(#apexLogo)"/>
  <text x="{XR+6}" y="404" text-anchor="end" fill="url(#apexLogo)" font-size="172" font-weight="800" letter-spacing="8">APEX</text>
  <text x="{XR}" y="476" text-anchor="end" fill="url(#apexSilver)" font-size="42" font-weight="600" letter-spacing="6" font-family="'DM Mono','Courier New',monospace">BUILT TO WIN</text>
  <text x="{XR}" y="530" text-anchor="end" fill="url(#apexSilver)" font-size="42" font-weight="600" letter-spacing="6" font-family="'DM Mono','Courier New',monospace">TUNED TO LAST</text>
</svg>
'''

out = os.path.join(os.path.dirname(__file__), "apex-thumbnail.svg")
with open(out, "w", encoding="utf-8") as f:
    f.write(svg)
print(f"wrote {out}  ({len(cells)} cells, {len(svg)} bytes)")

#!/usr/bin/env python3
"""Generate call-center-thumbnail.svg -- the Call Center console's index card.

The sibling of apex-thumbnail.gen.py, and built the same way: the console's own
picture on the left, dissolving under a right-aligned hero. The picture is the
runway from Call Center Live (one row per state, one column per start hour,
shaded by how much of the hour is still unconfirmed), with the past dimmed, the
current hour outlined in green, and the hot hours in amber, as the live page
draws them. Palette is the launcher's dark theme (Tools/tokens.css).

THUMBNAIL-STANDARD.md, held here rather than eyeballed:
  - viewBox 0 0 1200 675 (16:9), so the card's aspect-ratio box never crops it
  - text and essential graphics inside x 72..1128, y 72..603; the run fails if
    any text box, at the widest fallback font, would cross that line
  - SVG with real text

Re-run after any tweak:  python "Index Photos/call-center-thumbnail.gen.py"
"""
import math
import os
import random

W, H = 1200, 675
SAFE_X0, SAFE_X1, SAFE_Y0, SAFE_Y1 = 72, 1128, 72, 603

# --- the launcher's dark theme (Tools/tokens.css) ---
BG0, BG1 = "#0a0e1a", "#0f1424"
GREEN = "#78c832"    # Trinity green, the console accent
LIME = "#c5f135"
BLUE = "#29a9e1"     # Total Home blue
AMBER = "#ffb648"    # --warn: unconfirmed and close
IVORY = "#ededeb"    # the runway ramp's ink
LABEL = "#6f7076"    # --text-3
SILVER = "#7c828c"

# --- the runway ---
STATES = ["CT", "MA", "NJ", "NY", "OH", "PA", "RI"]
HOURS = list(range(9, 21))           # 9 AM to 8 PM start hours
NOW_COL = 3                          # 12 PM: the hours before it are past
X0, PX, CW = 150, 46, 38             # first cell x, column pitch, cell width
Y0, PY, CH = 152, 58, 46             # first cell y, row pitch, cell height
RAMP = [0.07, 0.19, 0.31, 0.44, 0.57, 0.71, 0.87]   # --ramp-1..7 opacities
VOLUME = {"CT": 0.52, "MA": 0.58, "NJ": 0.92, "NY": 0.80, "OH": 0.30, "PA": 0.86, "RI": 0.34}
HOT = {("NJ", 5), ("PA", 7), ("NY", 8), ("MA", 6)}   # unconfirmed and close: the calls to make

random.seed(13)


def hour_weight(h):
    """Sales appointments bunch late morning and again late afternoon."""
    return 0.35 + 0.55 * math.exp(-((h - 11.5) ** 2) / 3.0) + 0.75 * math.exp(-((h - 17.0) ** 2) / 4.0)


def fade(x):
    """Solid on the left, dissolving toward the hero, as the APEX card does."""
    if x <= 420:
        return 1.0
    return max(0.12, 1.0 - (x - 420) / 330.0)


cells = []
grid_right = X0 + (len(HOURS) - 1) * PX + CW
grid_bottom = Y0 + (len(STATES) - 1) * PY + CH
for r, st in enumerate(STATES):
    y = Y0 + r * PY
    cells.append(f'<text x="132" y="{y + 31}" text-anchor="end" fill="{LABEL}" font-size="22" '
                 f'font-weight="600" letter-spacing="1">{st}</text>')
    for c, h in enumerate(HOURS):
        x = X0 + c * PX
        load = VOLUME[st] * hour_weight(h) * (0.72 + 0.5 * random.random())
        level = max(0, min(len(RAMP) - 1, int(load * len(RAMP))))
        past = 0.42 if c < NOW_COL else 1.0
        if (st, c) in HOT:
            fill, op = AMBER, 0.9
        else:
            fill, op = IVORY, RAMP[level]
        op = op * past * fade(x)
        cells.append(f'<rect x="{x}" y="{y}" width="{CW}" height="{CH}" rx="6" fill="{fill}" '
                     f'opacity="{op:.3f}"/>')

ticks = []
for c, h in enumerate(HOURS):
    if h % 2 == 0:
        x = X0 + c * PX + CW / 2
        label = str(h if h <= 12 else h - 12)
        op = (0.55 if c < NOW_COL else 1.0) * fade(x)
        ticks.append(f'<text x="{x:.0f}" y="{Y0 - 16}" text-anchor="middle" fill="{LABEL}" font-size="18" '
                     f'font-weight="600" opacity="{op:.3f}">{label}</text>')

now_x = X0 + NOW_COL * PX - 5
now_band = (f'<rect x="{now_x}" y="{Y0 - 8}" width="{CW + 10}" height="{grid_bottom - Y0 + 16}" rx="9" '
            f'fill="none" stroke="{GREEN}" stroke-width="3" opacity="0.9"/>')

# --- the hero, right-aligned like the APEX card ---
XR = 1124
SANS = "'Plus Jakarta Sans',Helvetica,Arial,sans-serif"
MONO = "'DM Mono','Courier New',monospace"
HERO = [
    # (text, baseline y, font size, letter spacing, font, fill)
    ("COVERAGE COMMAND", 178, 24, 5, SANS, GREEN),
    ("CALL", 322, 142, 6, SANS, "url(#ccLogo)"),
    ("CENTER", 454, 142, 6, SANS, "url(#ccLogo)"),
    ("RIGHT LEADS, RIGHT HANDS", 520, 34, 5, MONO, "url(#ccSilver)"),
    ("EVERY STATE, EVERY SHIFT", 566, 34, 5, MONO, "url(#ccSilver)"),
]

# Widest fallback glyph widths, in em: Arial Bold capitals, and Courier's fixed 0.6.
ARIAL_BOLD = {"A": .722, "C": .722, "D": .722, "E": .667, "G": .778, "H": .722, "I": .278, "L": .611,
              "M": .833, "N": .722, "O": .778, "R": .722, "S": .667, "T": .611, "V": .667, "Y": .667,
              " ": .278, ",": .278}


def text_box(text, y, size, spacing, font):
    per_char = [0.6] * len(text) if font is MONO else [ARIAL_BOLD.get(ch, .722) for ch in text]
    width = sum(w * size for w in per_char) + spacing * (len(text) - 1)
    return XR - width, y - 0.74 * size, XR, y + 0.22 * size


for text, y, size, spacing, font, _fill in HERO:
    x0, y0, x1, y1 = text_box(text, y, size, spacing, font)
    assert SAFE_X0 <= x0 and x1 <= SAFE_X1 and SAFE_Y0 <= y0 and y1 <= SAFE_Y1, \
        f"'{text}' leaves the safe area: x {x0:.0f}..{x1:.0f}, y {y0:.0f}..{y1:.0f}"
assert 84 >= SAFE_X0 and grid_right <= SAFE_X1 and Y0 - 34 >= SAFE_Y0 and grid_bottom + 8 <= SAFE_Y1, \
    "the runway leaves the safe area"

hero_svg = []
for text, y, size, spacing, font, fill in HERO:
    weight = 800 if font is SANS else 600
    hero_svg.append(f'<text x="{XR}" y="{y}" text-anchor="end" fill="{fill}" font-family="{font}" '
                    f'font-size="{size}" font-weight="{weight}" letter-spacing="{spacing}">{text}</text>')
hero_svg.insert(1, f'<rect x="{XR - 150}" y="194" width="150" height="4" rx="2" fill="url(#ccLogo)"/>')

nl = "\n  "
svg = f'''<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" font-family="{MONO}">
  <defs>
    <linearGradient id="ccBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{BG0}"/><stop offset="1" stop-color="{BG1}"/>
    </linearGradient>
    <radialGradient id="ccGlowBlue" cx="0.74" cy="0" r="0.62">
      <stop offset="0" stop-color="{BLUE}" stop-opacity="0.15"/><stop offset="1" stop-color="{BLUE}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ccGlowGreen" cx="0.12" cy="1" r="0.62">
      <stop offset="0" stop-color="{GREEN}" stop-opacity="0.12"/><stop offset="1" stop-color="{GREEN}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ccHeroDark" cx="0.80" cy="0.56" r="0.52">
      <stop offset="0" stop-color="{BG0}" stop-opacity="0.94"/>
      <stop offset="0.55" stop-color="{BG0}" stop-opacity="0.64"/>
      <stop offset="1" stop-color="{BG0}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ccLogo" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="{LIME}"/><stop offset="1" stop-color="{BLUE}"/>
    </linearGradient>
    <linearGradient id="ccSilver" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="{SILVER}"/><stop offset="0.38" stop-color="{SILVER}"/>
      <stop offset="0.50" stop-color="#ffffff"/><stop offset="0.62" stop-color="{SILVER}"/>
      <stop offset="1" stop-color="{SILVER}"/>
    </linearGradient>
  </defs>
  <rect width="{W}" height="{H}" fill="url(#ccBg)"/>
  <rect width="{W}" height="{H}" fill="url(#ccGlowBlue)"/>
  <rect width="{W}" height="{H}" fill="url(#ccGlowGreen)"/>
  <!-- the runway: states by start hour, past dimmed, now outlined, hot hours amber -->
  {nl.join(ticks)}
  {nl.join(cells)}
  {now_band}
  <rect width="{W}" height="{H}" fill="url(#ccHeroDark)"/>
  {nl.join(hero_svg)}
</svg>
'''

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "call-center-thumbnail.svg")
with open(out, "w", encoding="utf-8", newline="\n") as f:
    f.write(svg)
print(f"wrote {out}  ({len(STATES) * len(HOURS)} cells, {len(svg)} bytes)")

# Index Photo (Card Thumbnail) Standard

Card images for `index.html`. Every card pulls `resources.image_url`. As of
2026-06 the thumbnails are a **per-section visual system**: each category has its
own background color, accent, icon motif, and title font, so a rep can tell the
section at a glance. All are SVG (vector, ~2 KB, crisp, real text).

## Canvas + safe margin (unchanged)
- `viewBox="0 0 1200 675"` (16:9). The card box is `aspect-ratio:1200/675`,
  `object-fit:cover`, so 16:9 art is never cropped.
- Keep text/essential graphics inside **x 72..1128, y 72..603** (~6% margin).
- Title is auto-sized to fit (see generator) so long titles never clip.

## Per-section system

| Section (theme key) | Background (dark -> vivid) | Accent | Motif | Title font |
|---|---|---|---|---|
| University | indigo -> royal purple | gold | mortarboard + gold rule | Palatino serif |
| Solar | navy -> bright blue | gold | sun | Helvetica/Arial sans |
| Roofing | slate charcoal -> steel | amber | double roof chevron | Georgia serif |
| Battery | dark -> vivid green | green/teal | battery + bolt | sans |
| Finance | emerald | gold | $ coin + gold rule | Georgia serif |
| Field Mastery | navy -> blue | green/cyan | target | Georgia serif |
| Reference | teal | cyan | open book | sans |
| Control Your Business | steel teal | orange | rising bar chart | sans |
| Skedulo & Tickets | slate -> cyan | cyan | ticket stub (shared) | sans |
| Management (other) | indigo / periwinkle | periwinkle | connected nodes | Trebuchet |
| Technology | dark -> electric blue | electric cyan | circuit | **Courier monospace** |
| Customer Experience | plum -> magenta | warm pink | envelope | Trebuchet |

Each card: section eyebrow (sans, accent color) + accent underline, a 1-2 line
white title in the section font, and a short subtitle. A radial `shade` keeps the
left (title) dark for legibility while the section color shows on the right.

## Generator (use this; do not hand-edit individual SVGs)
`Index Photos/_generate-thumbnails.ps1` defines the themes, motifs, and the full
card table (slug, theme, eyebrow, title lines, subtitle). To add/restyle a card:
edit the `$cards` table (and `$T`/`$M` for a new theme/motif), then run it. It
writes every `<slug>-thumbnail.svg`. Then point the card:
`resources.image_url = https://ct-resource-page.com/Index%20Photos/<slug>-thumbnail.svg`,
`image_type='custom'`. Commit + push the SVGs (GitHub Pages serves them; the
image_url row is live immediately but the file must deploy or the card 404s).

## Preview gotchas (so you don't chase ghosts)
- **Inlining** many SVGs into one page makes them share `#bg`/`#acc` gradient IDs,
  so they all inherit the FIRST SVG's gradient (everything looks like card #1).
  Real cards load each as a separate `<img>`, so this never happens live. To
  preview inline, uniquify the ids per SVG.
- Loading thumbnails as `<img>` from the GitHub Pages **404 page** fails (that
  page's CSP blocks images). Preview on a real site page, not a 404.

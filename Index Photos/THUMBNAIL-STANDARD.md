# Index Photo (Card Thumbnail) Standard

The standard for the card images on the resource page (`index.html`). Every
training/resource card pulls its picture from `resources.image_url`. Follow this
so cards stay crisp, light, and never clip their own text.

## The rule that matters most: aspect ratio

The card image box is **16:9** (`aspect-ratio: 1200 / 675` in `index.html`).
Whatever you make is shown in a 16:9 frame with `object-fit: cover`. As long as
your art is also 16:9, nothing gets cropped. If your art is a different ratio,
cover will crop the long edge.

> History: the box used to be a fixed 110px tall. That letterboxed the 16:9 art
> and sliced ~27% off the top and bottom, so the subtitle line was cut off on
> every card. Fixed 2026-06-04 by switching the box to a 16:9 aspect ratio.

## Format

- **SVG strongly preferred.** Vector, ~1-2 KB, perfectly crisp at any screen
  density, and the text is real text (never rasterized, never blurry). All new
  thumbnails are SVG.
- **PNG only for photographic art** (a real photo, a rebate flyer, a screenshot).
  If PNG: export at exactly 1200x675 and compress (TinyPNG / oxipng / squoosh)
  to **under 80 KB**. The legacy 50-120 KB PNGs are being replaced by SVGs.

## Size

- Canvas: **1200 x 675 px** (16:9). For SVG: `viewBox="0 0 1200 675"`.
- This is both the design size and the display ratio, so what you draw is what
  shows.

## Safe margin

- Keep all text and essential graphics **at least 72 px from every edge**
  (~6% of width). The card has a 10px border-radius that nips the top corners,
  and browsers anti-alias the outer edge, so the outer band is unreliable.
- Especially keep text out of the four corners.
- Practical safe box: x 72..1128, y 72..603.

## House layout (the default template)

Navy gradient background, two faint accent circles, a category eyebrow with an
accent underline, a Georgia serif title (1-2 lines), and a short subtitle.
Copy any recent SVG (e.g. `solar-objections-thumbnail.svg`) as a starting point.

Tokens:
- Background gradient: `#0F2038` -> `#1A2942`
- Accent gradient (underline): `#78C832` -> `#29A9E1`
- Title text: `#FFFFFF` (Georgia serif, bold, ~96-112px)
- Eyebrow / subtitle: `#9FB3C8` (Helvetica/Arial, bold)
- DISC colors (use for personality content): D `#E84040`, I `#F5A623`,
  S `#78C832`, C `#29A9E1`

The DISC pieces (`know-your-style`, `know-your-buyer`) use a variant: a 2x2
four-color DISC quadrant on the right instead of the accent circles. That is the
"own look" for personality content -- reuse it for future DISC material.

## Naming + wiring

- File: `Index Photos/<slug>-thumbnail.svg`
- DB: set `resources.image_url` =
  `https://ct-resource-page.com/Index%20Photos/<slug>-thumbnail.svg`
  (note the `%20` for the space) and `image_type = 'custom'`.
- Commit the SVG to the repo and push (GitHub Pages serves it). The `image_url`
  row change is live immediately, but the file must be deployed or the card 404s
  its image (it falls back to a type emoji).

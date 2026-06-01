# Sales Training Authoring Standard

*The contract for building training pages on ct-resource-page.com. Governs structure, instructional design, and markup. Pairs with the voice guide.*

---

## 0. Authority and pairing

This standard owns **structure, learning design, and HTML semantics.**
It does **not** own voice. Prose voice is governed by **`Voice_General.md`**
(canonical path: `C:\Users\dan\OneDrive\AI\Voice_General.md`).

**Mandatory before authoring or editing any training page:** read this file and apply `Voice_General.md`. The two together are the full spec. This standard is the single source of truth for the resource page; do not copy it elsewhere. Reference it by pointer only, so it cannot drift.

---

## 1. The learning model (why the rules exist)

Four research findings drive every rule below. Know the why so you can make good calls in gray areas.

- **People scan, they don't read.** Eyetracking shows an F-pattern: users sweep the top, then ride the left edge. So front-load the information-carrying word in every heading, bullet, and sentence.
- **Working memory is small.** Microlearning (one objective, 3 to 10 minutes) lifts retention up to ~50% by cutting cognitive load. So chunk to one idea; split anything longer than ~5 items.
- **Two channels beat one.** Pairing words with a visual builds two memory paths (dual coding). So every concept earns a visual anchor: a grid, a table, a callout. Not decoration, structure.
- **Retrieval beats re-reading.** Self-testing outperforms repetition. So modules end with recall, not just a summary.

---

## 2. The four pillars (at a glance)

| Pillar | Goal | One-line test |
|---|---|---|
| **1. Semantics** | Scannable, retention-first content | Can a rep get the point in a 5-second scan? |
| **2. Structure** | Theme swap = CSS only, zero HTML edits | Could I restyle this with no markup changes? |
| **3. Density** | Maximum signal per screen | Is every element earning its space? |
| **4. Retention & Modes** | One source, four jobs | Does this work in-home, solo, and on the meeting screen? |

---

## 3. Pillar 1 — Content and design semantics

- **No walls of text.** Chunk into steps, lists, or comparison grids. A paragraph over ~3 sentences is a smell.
- **Bold the first 2 to 4 words of every bullet.** That's the left stem of the F-pattern. Make those words carry the meaning, not filler.
- **Front-load headings and sentences.** Lead with the noun that matters. "Quitclaim deeds transfer..." beats "There is a type of deed that...".
- **Use semantic anchors, not generic divs,** so the meaning is in the markup:
  - `<aside class="objection-handling">` — a customer pushback and the counter-strategy.
  - `<blockquote class="script-example">` — exact words to say, verbatim.
  - `<div class="metric-callout">` — a number, ratio, or win-rate worth isolating.

---

## 4. Pillar 2 — Structure and maintenance (theme-agnostic)

- **Flat markup.** No deep wrapper nesting. A section holds its components directly. If you have a div wrapping a div wrapping a div, collapse it.
- **Zero inline styles.** Never `style="..."`. Every visual decision lives in a class. This is non-negotiable; it's what makes theming and Presenter Mode possible.
- **Structural component classes only.** Name by *what it is*, not what it looks like: `training-card`, `step-grid`, `recall-check`. Never `blue-box` or `mt-24`.
- **Target architecture: one shared stylesheet.** The end state is a single `/training-system.css` holding design tokens + all component classes, linked by every page. Pages become pure semantic HTML. *(Interim: pages may carry an embedded `<style>` block until the shared sheet is extracted, but the class names must already match this standard so extraction is a lift-and-shift.)*
- **Tokens, not literals.** Color, spacing, and radius come from CSS custom properties (`--ink`, `--space-3`). A theme change edits tokens, nothing else.

---

## 5. Pillar 3 — Spacing and layout (the slide model)

Every module is a **slide.** Think PowerPoint: one objective, filling the screen, readable across a room. This serves the meeting use case *and* makes the page a faster reference, because the answer is one nav-click away and already framed on screen.

- **One module = one viewport slide.** A module fills the screen width and *aims to fit one screen tall.* Center the content vertically. If content genuinely can't fit (a long table), it may overflow, but design to avoid it: tighten copy, go multi-column, or split into two slides.
- **Fill the width, fight the height.** Spread content horizontally to keep it short vertically. Default to side-by-side: `card-grid`, `compare-grid`, `step-grid`, and **multi-column lists** (`list-cols`). A single tall column is the failure mode.
- **Multi-column lists.** Even bullet lists use columns (`list-cols`) so they consume width, not height. Collapse to one column on mobile.
- **Large, simple type.** Base size is bumped for legibility across a room. Short lines, high contrast, no fine print. If a manager can't read it from the back, it's too small.
- **Scroll-snap on desktop.** Modules snap into place; the TOC nav steps slide-to-slide like a deck. **Mobile relaxes** to normal vertical scroll (a phone is close-up, not across-the-room): snap off, slides go auto-height, grids and `list-cols` collapse to one column.
- **Limit padding and vertical margin.** Tight, purposeful spacing. No swimming through whitespace, and no decorative graphics or filler.
- **Layout primitives:** `card-grid` (auto-fit cards), `compare-grid` (side-by-side), `step-grid` (numbered process), `list-cols` (multi-column list). All fill width on desktop, all collapse to one column on mobile.

---

## 6. Pillar 4 — Retention and modes (one source, four jobs)

The same page serves four settings: **in-home lookup, solo study, manager-led meeting (wide screen), and mobile.** Content is authored once; *mode* is a presentation concern, never duplicated content. The page is a **slide deck** (Section 5); Reading mode and Presenter mode are two render states of that one deck.

- **Default = clean scannable reference.** Optimized for the in-home "find the answer fast" job. Nothing interactive gets in the way.
- **Recall is collapsible.** Use `<details class="recall-check">` with a `<summary>` question and the answer inside. Native, zero-JS, accessible. Collapsed by default, so it stays out of the way in scan mode, expands for a solo self-test, or the manager asks the room then reveals.
- **Presenter Mode is a body class.** A toggle adds `body.presenter`: larger type, higher contrast, full-width, and it reveals `<div class="manager-prompt">` elements (discussion questions for the manager) that are `display:none` in normal reading. Same file, reshaped for the meeting screen.
- **Presenter Mode strips page chrome.** It hides the TOC nav and the site-back button (`#site-back-btn`), and resets `--header-h` to the now-shorter header (the nav bar is gone) so no dead band appears under the header. A deck shows content, not navigation.
- **Manager prompts** live in the markup but hide by default; they surface only in Presenter Mode.
- **Deck navigation.** Provide fixed prev/next arrows (bottom-right, clear of the bottom-left site-back button) that step slide-to-slide via `scrollIntoView`. Arrow keys (and PageUp/PageDown) do the same. Buttons disable at the deck ends.
- **Reset scroll when the gate opens.** The auth gate reveals content a few seconds after load, so set `history.scrollRestoration='manual'` and call `window.scrollTo(0,0)` inside `initApp`. Otherwise the browser restores the last scroll position and the deck "jumps" mid-load.
- **Phone push is Phase 2.** Live "manager triggers a question to reps' phones" is possible on the existing Supabase + auth stack, but it needs a session/push layer. Scope it later; do not block v1 on it.

Every module ends with **either** a `recall-check` (self-test) **or** a `key-takeaways` recap. Important modules get both.

---

## 7. Writing for concision (the redundancy killers)

Default drafts run ~2x longer than they need. Cut to earn the reader's attention. Apply every pass:

- **One idea per sentence.** If it has an "and" joining two thoughts, split it.
- **Cut throat-clearing.** Delete "simply," "basically," "the fact that," "in order to," "it's important to note." They add length, not meaning.
- **Active voice, present tense.** "The deed decides the signer," not "The signer is decided by the deed."
- **Numerals, not words.** "16 scores," not "sixteen scores." Numerals catch the scanning eye.
- **Lead with the answer.** Put the conclusion first, the explanation second. Reps reading in a driveway need the takeaway in line one.
- **The earns-its-place test (from Voice_General).** Read each sentence and ask: does it change what the rep will do? If not, cut it.

**Worked example:**

> Before (52 words): *"A solar agreement is a contract tied to a specific property. The people who sign it have to be the people who legally own that property. If the name on the deed and the name on the agreement don't line up, the deal cannot fund. Title work is simply making sure those names match before you get there."*

> After (24 words): *"A solar agreement binds one property. Everyone on the deed signs, or it can't fund. Title work is matching deed names to signatures before you arrive."*

Same meaning, half the words, faster scan.

---

## 8. Semantic component vocabulary (the class contract)

Build only from these. Add to this list deliberately, never inline a one-off.

| Class | Element | Use for | Skeleton |
|---|---|---|---|
| `training-page` | `main` | Root content wrapper | `<main class="training-page">` |
| `module` | `section` | One learning objective (the chunk) | `<section class="module" id="…"><h2>…</h2></section>` |
| `training-card` | `div` | Base content block | `<div class="training-card"><h3>…</h3>…</div>` |
| `step-grid` / `step` | `ol` / `li` | Numbered process | `<ol class="step-grid"><li class="step">…</li></ol>` |
| `compare-grid` | `div` | Side-by-side comparison | `<div class="compare-grid"><div class="training-card">…</div>…</div>` |
| `card-grid` | `div` | Auto-fit set of cards | `<div class="card-grid">…</div>` |
| `list-cols` | `ul` | Multi-column bullet list (fills width) | `<ul class="list-cols">…</ul>` |
| `objection-handling` | `aside` | Pushback + counter-strategy | `<aside class="objection-handling"><p class="objection">…</p><p class="counter">…</p></aside>` |
| `script-example` | `blockquote` | Verbatim words to say | `<blockquote class="script-example">"…"</blockquote>` |
| `metric-callout` | `div` | A number/ratio/stat | `<div class="metric-callout"><span class="figure">16</span><span class="caption">…</span></div>` |
| `do-dont` | `div` | Say-this / not-that pairing | `<div class="do-dont"><div class="do">…</div><div class="dont">…</div></div>` |
| `checklist` | `ul` | Actionable pre-flight list | `<ul class="checklist"><li>…</li></ul>` |
| `recall-check` | `details` | Collapsible self-test Q/A | `<details class="recall-check"><summary>Q?</summary><p>A.</p></details>` |
| `manager-prompt` | `div` | Discussion prompt (Presenter Mode only) | `<div class="manager-prompt">Ask the room: …</div>` |
| `key-takeaways` | `section` | Closing recap | `<section class="key-takeaways"><ul>…</ul></section>` |
| `callout` | `div` | Inline tip / compliance note | `<div class="callout callout--compliance">…</div>` |

Modifiers use a suffix: `callout--compliance`, `training-card--warn`. Never a separate inline style.

---

## 9. Required page skeleton

```
<head> … design tokens + components (interim: embedded <style>; target: <link> shared sheet) …
        auth-gate.css + supabase + auth-gate.js + site-back.js, meta robots noindex
<body>
  loginScreen / changePasswordScreen / appWrap   (auth gate, unchanged)
  header.site-header  → brand + sticky TOC nav (anchors to each module id)
  header/hero         → eyebrow + h1 + one-sentence lede (front-loaded)
  main.training-page
    section.module#…   (repeat; one objective each; ends in recall-check or key-takeaways)
  section.key-takeaways
  footer
  Presenter Mode toggle + TOC scroll-spy script
  initApp(profile, session)   (required no-op for auth-gate)
```

- **No em dashes anywhere.** Use `--` or restructure. (Per Voice_General.)
- **One `<h1>` per page.** Modules use `<h2>`, sub-points `<h3>`.

---

## 10. Pre-publish checklist

- [ ] Every bullet front-loads bold keywords (2 to 4 words).
- [ ] No paragraph exceeds ~3 sentences.
- [ ] Zero inline `style=` attributes.
- [ ] All visuals use vocabulary classes; no one-off divs.
- [ ] Every concept has a visual anchor.
- [ ] Each module ends in recall or takeaways.
- [ ] Ran the concision pass; cut throat-clearing and split compound sentences.
- [ ] No em dashes.
- [ ] Reads clean at a 5-second scan; reads full on a wide screen.

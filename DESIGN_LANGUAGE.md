# coolmathgames2.0 — Design Language
Self-contained spec. An LLM with only this file should produce correct CSS. When this document and instinct conflict, this document wins.
---
## 1. North star
**1998–2003 web. The table-layout, black-background, primary-colors era.** The original coolmath.com: pure black page, modules boxed in bright solid borders, yellow links, chunky outlined display text, beveled 3D buttons, `>>>>` arrow dividers, "NEW!" badges. Dense, loud, honest, safe-for-school.
This is a *revival built with modern CSS*, not a museum piece: responsive, accessible, fast. The constraint set below reproduces the era's look via grid/flex/custom-properties — never via actual `<table>` layout, image spacers, or Flash-era hacks.
Hard exclusions (these break the era):
- **No** flat/minimal post-2014 design: no whitespace-worship, no muted palettes, no ghost buttons, no thin type, no giant hero sections with one centered sentence.
- **No** late-2000s gloss deluge: no aqua/glass buttons, no wet-floor reflections, no heavy gradients on every surface, no skeuomorphic leather/paper.
- **No** glassmorphism, no neumorphism, no dark-mode-gray (#1a1a1a etc. — background is *black*), no border-radius over 6px except the nav pill and the planet, no Inter/Roboto/system-ui for display text.
- **No** drop shadows for "elevation." Shadows exist only as hard-edged offsets (see §6) or text outlines.
---
## 2. Color
Base is pure black. Color arrives as saturated primaries used at full strength — borders, text, badges — never as tints, never desaturated, never with opacity washes.
```css
:root {
  /* surfaces */
  --ink-black:    #000000;  /* page background. Non-negotiable. */
  --panel-navy:   #14206e;  /* alt panel fill (header band, card interiors) */
  --panel-blue:   #2f7fd0;  /* logo-planet blue; hero/header fills */
  /* the four module colors — rotate per panel border, in this order */
  --mod-red:      #ff2a2a;
  --mod-green:    #21d421;
  --mod-blue:     #3a8dff;  /* border/graphic use only — NEVER text on black */
  --mod-yellow:   #ffe000;
  /* text */
  --text-body:    #ffffff;  /* body copy on black/navy */
  --text-link:    #ffff00;  /* unvisited links */
  --text-visited: #00e5ff;  /* visited links */
  --text-on-yellow: #000000;
  /* accents */
  --hot-red:      #e8231a;  /* display text fill (logo red) */
  --outline-yellow: #ffd400;/* display text outline */
  --star-white:   #ffffff;
  --go-green:     #35c435;  /* primary CTA fill ("GO", "PLAY") */
}
```
Rules:
- Text on `--ink-black` may be: white, yellow, green, cyan, red. **Never blue** (contrast fails). Blue is for borders, fills, and graphics only.
- Panel borders cycle red → green → blue → yellow down the page. Adjacent panels never share a border color.
- No grays anywhere. Disabled = 50% opacity on the element, not a gray palette entry.
- Gradients: permitted in exactly two places — the rainbow divider (§6) and optional chrome-text on the H1. Nowhere else.
## 3. Typography
```css
:root {
  --font-display: 'Luckiest Guy', 'Arial Black', sans-serif;  /* logo/H1/H2: fat, bubbly, era-correct */
  --font-body:    Verdana, Tahoma, 'DejaVu Sans', sans-serif; /* authentic 90s web-safe body */
  --font-utility: 'Courier New', monospace;                    /* scores, timers, stats */
}
```
- Display (`Luckiest Guy`, Google Fonts) is for the wordmark, H1, H2, and big CTAs only. Always with the outline treatment (§5). Never for body or UI labels.
- Body is Verdana at **13–15px**, line-height 1.45. Era text was small and dense; keep it small but legible. Bold is the only weight — no light/medium weights exist in this universe.
- Nav tabs / badges / buttons: Verdana bold, UPPERCASE, 11–13px, letter-spacing 0.02em.
- Utility mono for anything numeric-gamey: `SCORE: 04200`, countdowns, level indicators. Zero-pad numbers.
- No fluid `clamp()` type scaling drama. Fixed sizes per breakpoint. Headings jump in chunky steps: H1 40–56px, H2 24–28px, H3 = body bold uppercase.
## 4. Layout
- Content column: **max-width 960px, centered** on the black void. The void is part of the design — on wide screens the page floats as a lit-up rectangle in darkness. Optional sparse white 1–2px "star" dots (CSS background, static) in the void.
- Structure top-to-bottom: header band (blue fill, planet + wordmark) → yellow nav bar → rainbow divider → module grid → footer of dense small links.
- Modules are **bordered boxes packed tight**: 8–12px gaps, not 40px of air. 2-column grid desktop, 1-column mobile. Density is the aesthetic — a screen should show 4+ modules above the fold.
- Every module: `2px solid` border in its cycle color, 10–14px interior padding, optional title strip (color-filled bar, black or white bold uppercase text) at top.
- Section headers sit between `>>>>` and `<<<<` glyph runs, literally: `>>>> JIGSAW PUZZLES <<<<` in yellow bold.
- Footer: black, dense pipe-separated small yellow links (`about | privacy | terms`), Verdana 11px. This is era-load-bearing; don't modernize it.
## 5. Display text treatment (the signature)
The one memorable element. Big display text is **red fill, thick yellow outline, hard offset shadow** — the logo treatment, extended to every H1/H2.
```css
.display-text {
  font-family: var(--font-display);
  color: var(--hot-red);
  -webkit-text-stroke: 2px var(--outline-yellow);
  paint-order: stroke fill;
  text-shadow:
    3px 3px 0 #ffffff,   /* white outer pop */
    5px 5px 0 rgba(0,0,0,.55); /* hard drop */
  transform: rotate(-2deg);    /* slight tilt, wordmark only — headings stay level */
  letter-spacing: 0.01em;
}
```
- Wordmark sits on the planet: blue circle + green ellipse ring, pure CSS or inline SVG (circle, ellipse, rotate). No image asset needed.
- H2 variant: same recipe, stroke 1.5px, no rotation, no white layer.
- Spend boldness here. Because headings are this loud, everything else (body, borders, buttons) stays disciplined and flat-colored.
## 6. Chrome & detailing
**Bevels.** Buttons and interactive tiles use the Win95/arcade outset bevel — hard 2px light/dark edges, no blur:
```css
.btn {
  background: var(--go-green);
  color: #000;
  border: none;
  box-shadow:
    inset 2px 2px 0 rgba(255,255,255,.7),
    inset -2px -2px 0 rgba(0,0,0,.45);
  padding: 8px 18px;
  font: bold 13px var(--font-body);
  text-transform: uppercase;
}
.btn:active {          /* pressed = invert the bevel, nudge 1px */
  box-shadow:
    inset -2px -2px 0 rgba(255,255,255,.6),
    inset 2px 2px 0 rgba(0,0,0,.45);
  transform: translate(1px, 1px);
}
```
Button colors: green = primary/play, yellow (black text) = nav/secondary, red = destructive/quit. Radius 0–4px.
**Rainbow divider.** One horizontal rule style site-wide: 4px tall, hard-stop gradient `red → yellow → green → cyan → blue → magenta` (use `linear-gradient` with doubled color stops so bands are hard-edged, not blended).
**Badges.** `NEW!`, `HOT!`, `FREE!` — yellow or red rectangles, black bold uppercase 10px, 2px black border, optionally rotated ±3deg, absolutely positioned overlapping a corner of their module.
**Arrow glyphs.** `»`, `>>>`, `→` as literal text decorations before links and in section headers. Yellow.
**Links.** Yellow, **underlined always** (this era never hid underlines). Visited cyan. Hover: background flips to yellow, text to black — a hard swap, no transition easing longer than 80ms.
## 7. Motion
Era motion was blink and marquee. Homage it, sparingly, and gate everything:
- Allowed: badge blink (steps(1) opacity toggle, ≤3 items per screen), a single marquee-style ticker (CSS translateX loop) for announcements, `:active` press nudges, star twinkle in the void.
- Forbidden: parallax, scroll-triggered fades, easing curves smoother than `steps()` or `linear` on decorative motion, skeleton shimmer, spring physics.
- Everything decorative inside `@media (prefers-reduced-motion: no-preference)`. Reduced motion = static site, fully functional.
## 8. Voice
Copy is era-correct: exclamatory, direct, second person, safe-for-school. Short imperatives on controls: `PLAY!`, `GO!`, `TRY IT!`. Descriptions are one enthusiastic sentence ending in a hook question ("Can you beat all 12 levels?"). The header tagline pattern is a chant: `STAY SAFE, STAY WELL • PLAY SAFE, PLAY WELL`. Never corporate ("Get started", "Learn more", "Explore our platform"), never ironic — the site is sincerely excited, not winking at the reader.
## 9. Modern floor (invisible, mandatory)
- Responsive to 360px: modules stack, nav pills wrap or collapse to a scrollable row, display text steps down (H1 min 28px).
- Keyboard focus: `outline: 3px dashed var(--mod-yellow); outline-offset: 2px;` — era-flavored and obvious. Never `outline: none` without replacement.
- Contrast: enforced by §2 rules (no blue text on black, black text on yellow/green fills).
- Semantic HTML under the retro paint: real `<nav>`, `<button>`, headings in order. Layout via grid/flex only.
- Tap targets ≥ 40px despite dense visuals — pad interactive elements, keep visual density via tight gaps.
## 10. Quick reference — do / don't
| Do | Don't |
|---|---|
| Pure black background | Dark gray "dark mode" |
| 2px solid primary-color borders, rotating | Border-radius 12px cards with soft shadows |
| Yellow underlined links | Unstyled or muted links |
| Beveled buttons, hard press states | Ghost buttons, hover lifts with blur shadows |
| Dense 8–12px gaps | 64px section padding |
| Red/yellow outlined display type | Thin geometric sans headlines |
| `>>>>` glyphs, NEW! badges, one blink | Scroll animations, parallax, shimmer |
| Verdana 13px body | Inter 16px body |

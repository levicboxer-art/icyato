# Cyato Tea Plantation & Factory Ltd — Website

Premium, cinematic B2B website for a single-origin Rwandan tea plantation and
CTC factory in Nyamasheke District.

The site is **dependency-free**: a small Node build script assembles static HTML
from partials and hashed CSS/JS, and a small Node server serves the result. No
framework, bundler or runtime library is required in production.

```
src/            source HTML, CSS and JS
  pages/        one file per route (front-matter block at the top)
  partials/     shared head, header, footer, CTA
  styles/       design system (main.css)
  scripts/      cinematic.js (canvas engine), site.js (interaction)
public/assets/  frames, editorial stills, fonts, icons
dist/           generated output (do not edit)
build.mjs       static builder
server.js       local/production-style static server
```

## Commands

```bash
node build.mjs     # build dist/ from src/ + public/
node server.js     # serve at http://localhost:4321
```

Rebuild after any change in `src/`. CSS/JS filenames are content-hashed, so
browsers pick up new assets automatically; HTML is served `no-cache`.

## Cinematic sequence

`src/scripts/cinematic.js` renders the 248-frame journey on a single canvas
inside a sticky, pinned stage.

- Scroll position maps directly to a frame index (no easing lag, reversible).
- Frames are **not** all preloaded. A moving window around the playhead is
  requested (24 ahead / 12 behind on desktop, 16 / 8 on mobile), and decoded
  frames outside the keep radius are released. The frame currently on screen is
  never evicted, so long jumps do not blank the canvas.
- Two frame variants: `frames/800/` (800×450) and `frames/640/` (640×360 for
  viewports ≤ 640px).
- Chapter overlays are driven by frame ranges: 0–47, 48–83, 84–119, 120–191,
  192–247, plus the brand reveal section that follows.
- A poster image, a loader with a progress bar and a timeout safety net keep the
  first view meaningful on slow connections.
- `prefers-reduced-motion` switches to a static, fully readable presentation of
  all chapters; no scroll scrubbing occurs.

## Content policy

Only verified company information is published: the Nyamasheke address, the
telephone number, the five tea grades and their cup descriptions, CTC processing
stages, and Mombasa Tea Auction participation. No prices, chemical
specifications, certifications, founding dates, employee counts, client names or
export figures are stated. Certifications and lot specifications are offered
"on request" instead.

## Contact form

The inquiry form validates client-side and shows an explicit status message:
**no data is transmitted**, because no mail/CRM endpoint is configured. It
presents a reference summary and the telephone number as the immediate route.
To enable real submission, add an endpoint and replace the `submit` handler in
`src/scripts/site.js`.

## Known limitations

- The source footage is 800×450, so the cinematic upscales on large displays.
- The inquiry form has no backend (see above).
- Google Maps is click-to-load to avoid loading a third-party iframe on every
  visit.

`legacy/scroll-prototype.html` is the original single-file prototype, kept for
reference only; it is not part of the build.
